// Web Splash — минималистичный layer между native splash (drawable, ~1.5с
// для cold-start) и app/auth content. Раньше тут был свой <img splash-bg.jpg>
// + BrandTitle с текстом «TECH FORUM 2026». Юзер видел двойной splash:
// native picture (с лого) → web hero-картинка с текстом → blueprint app.
// Каждый переход — visible jump (разные image scales / fonts / decode time).
//
// Round 8: убираем web hero-image и текст полностью. AppBackground (blueprint)
// уже отрисован за этим layer'ом — пока auth-check не завершился, юзер видит
// просто фирменный фон без текста. Native splash покрывает первые ~1.5с с
// картинкой, потом мгновенно blueprint без рывка.
export default function Splash() {
  return (
    <div
      className="relative flex flex-col items-center justify-center px-6"
      style={{ minHeight: '100lvh' }}
      aria-hidden="true"
    />
  );
}
