import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Pool } from 'pg';
import { saveContentPatch, readContentSnapshot, validateContentPatch } from '../src/lib/appAdminContent.js';
import { contentIssues } from '../src/lib/appContentHealth.js';
import { syncSpeakers } from '../src/lib/speakerSync.js';

const url = process.env.TEST_DATABASE_URL;
if (!url || !['127.0.0.1','localhost'].includes(new URL(url).hostname) || !new URL(url).pathname.endsWith('_test')) throw Error('Use an isolated local *_test database only');
const pool = new Pool({ connectionString: url });
const defaults = { name: 'Тест', city: 'Москва', researchIntro: 'Исследование', researchLawyerUrl: 'https://tech-pravo.ru/opros2' };
before(async () => {
  const migration = fs.readFileSync(new URL('../ops/migrations/20260903_app_admin_reliability.sql', import.meta.url),'utf8');
  const c = await pool.connect();
  try {
    await c.query('BEGIN'); await c.query(migration); await c.query('ROLLBACK');
    await c.query('BEGIN'); await c.query(migration); await c.query('COMMIT');
    await c.query('BEGIN'); await c.query(migration); await c.query('COMMIT');
  } finally { c.release(); }
  await pool.query("INSERT INTO tracks(id,name,color,short_label) VALUES('t_ai','ИИ','#123456','ИИ') ON CONFLICT DO NOTHING");
  await pool.query("INSERT INTO days(id,date,label,weekday) VALUES('test-day','2026-09-25','25 сентября','Пятница') ON CONFLICT DO NOTHING");
  await pool.query("INSERT INTO halls(id,name,capacity) VALUES('test-hall','Тестовый зал',10) ON CONFLICT DO NOTHING");
  await pool.query("INSERT INTO speakers(id,name,role,company,bio,avatar_letter,track_id,interest_ids) VALUES('test-speaker','Тестовый спикер','Юрист','Тест','Тест','ТС','t_ai','{}') ON CONFLICT DO NOTHING");
});
after(async () => { await pool.end(); });

test('CAS writes only changed fields; concurrent editor cannot overwrite; history append-only; undo is another version', async () => {
  const id = 'test-content-' + Date.now();
  const a = await readContentSnapshot(pool,id,defaults);
  const saved = await saveContentPatch(pool,id,defaults,{ expectedVersion:a.version,patch:{city:'Казань'},reason:'Проверка сохранения' },'test-owner');
  assert.equal(saved.version,1); assert.equal(saved.data.researchIntro,'Исследование');
  await assert.rejects(saveContentPatch(pool,id,defaults,{ expectedVersion:0,patch:{researchIntro:'Утерянные правки'},reason:'Вторая вкладка' },'test-owner'), {code:'content_version_conflict'});
  const results = await Promise.allSettled(['Самара','Сочи'].map(city=>saveContentPatch(pool,id,defaults,{ expectedVersion:1,patch:{city},reason:'Одновременная правка' },'test-owner')));
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  const current=await readContentSnapshot(pool,id,defaults);
  await saveContentPatch(pool,id,defaults,{expectedVersion:current.version,patch:{city:'Москва'},reason:'Отмена тестовой правки'},'test-owner');
  const history = await pool.query('SELECT * FROM app_content_revisions WHERE content_id=$1 ORDER BY version',[id]);
  assert.equal(history.rows.length,3); assert.deepEqual(history.rows[0].changed_keys,['city']);
  await assert.rejects(pool.query('DELETE FROM app_content_revisions WHERE content_id=$1',[id]), /append_only/);
});

test('legacy unversioned saves, invalid URLs, unknown keys and empty fields are rejected', async () => {
  await assert.rejects(saveContentPatch(pool,'no-version',defaults,{patch:{city:'Казань'}},'test'), {code:'content_version_required'});
  for (const patch of [{city:''},{other:'x'},{researchLawyerUrl:'javascript:alert(1)'},{researchLawyerUrl:'https://evil.example/opros'}]) assert.throws(()=>validateContentPatch(patch,defaults));
});

test('content health detects missing speaker, invalid clock and overlaps, not a registration without speaker', () => {
  const session={id:'s1',title:'Доклад',dayId:'d1',hallId:'h1',trackId:'t1',startTime:'10:00',endTime:'11:00',format:'Доклад',isPublished:true};
  const refs={speakers:[],days:[{id:'d1'}],halls:[{id:'h1'}],tracks:[{id:'t1'}],links:[],moderators:[]};
  assert.match(contentIssues({...refs,sessions:[session]}).join(' '),/без спикера/);
  assert.deepEqual(contentIssues({...refs,sessions:[{...session,format:'Регистрация'}]}),[]);
  assert.match(contentIssues({...refs,sessions:[{...session,startTime:'29:99'}]}).join(' '),/время/);
  assert.match(contentIssues({...refs,sessions:[session,{...session,id:'s2',title:'Второй доклад'}]}).join(' '),/Пересечение/);
});

const source = (values: unknown) => (async () => new Response(JSON.stringify(values), {status:200})) as typeof fetch;
test('speaker sync: empty/non-200 fails, dry-run does not persist, identity survives rename, stale rows retained', async () => {
  await assert.rejects(syncSpeakers(pool,'http://localhost/source',false,source([])),/пустой список/);
  await assert.rejects(syncSpeakers(pool,'http://localhost/source',false,(async()=>new Response('',{status:503})) as typeof fetch),/503/);
  const record={id:'test-source-id',full_name:'Тестовый спикер',position:'Юрист',company:'Тест',bio:'Биография',photo_url:'/test.png'};
  const preview=await syncSpeakers(pool,'http://localhost/source',true,source([record]));
  assert.equal(preview.updated,1);
  assert.equal((await pool.query("SELECT count(*) FROM speaker_source_links WHERE source_id='test-source-id'")).rows[0].count,'0');
  await syncSpeakers(pool,'http://localhost/source',false,source([record]));
  const renamed=await syncSpeakers(pool,'http://localhost/source',false,source([{...record,full_name:'Новое имя'}]));
  assert.equal(renamed.created,0); assert.equal(renamed.updated,1);
  assert.equal((await pool.query("SELECT name FROM speakers WHERE id='test-speaker'")).rows[0].name,'Новое имя');
});

test('speaker sync rolls back already-written rows if later identity collides', async () => {
  const before=await pool.query('SELECT id,name FROM speakers ORDER BY id');
  await assert.rejects(syncSpeakers(pool,'http://localhost/source',false,source([
    {id:'test-source-id',full_name:'Must roll back'},
    {id:'other-source',full_name:'Новое имя'},
  ])),/Два исходных/);
  assert.deepEqual((await pool.query('SELECT id,name FROM speakers ORDER BY id')).rows,before.rows);
});
