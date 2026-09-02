# TechPravo 1.8.11 (36) — owner signing handoff

This folder contains the latest verified client source output from commit
`21f2e573f1ba6b56e88324cf432bb68f016109d6`.

## Android

`TechPravo-Android-1.8.11-36-QA-NOT-FOR-RUSTORE.apk` is an installable QA
package. It is intentionally signed by the Android debug certificate and must
not be uploaded to RuStore. The final RuStore AAB can only be produced after
the owner provides the existing app's release keystore through local protected
environment variables and confirms the certificate match in RuStore Console.

## iPhone

`TechPravo-iOS-1.8.11-36-Xcode-Project-NOT-IPA.zip` is a synchronized Xcode
project with the compiled web client and the eight allowed native plugins. It
is not an IPA. Install full Xcode, sign with the owner's Apple Developer Team,
then run Archive, Validate App and upload the processed build to TestFlight.

Do not send passwords, private keys, certificates, provisioning profiles or
two-factor authentication codes through chat.
