/// Node's `JSON.stringify` throws on a raw `BigInt` ("Do not know how to serialize a
/// BigInt") — a latent gap since `Document.sizeBytes`/similar Prisma `BigInt` columns were
/// introduced (Phase 02/07), only now surfaced because Phase 12's real upload path always
/// populates `sizeBytes` on every response, where before it was rarely set in test/JSON-
/// body-driven fixtures. `JSON.stringify` calls `.toJSON()` on a value when present — the
/// standard, widely-used fix for a Node.js + BigInt + JSON API. A side-effect import
/// (imported once from `app.module.ts`, which every production bootstrap AND every e2e
/// test's `Test.createTestingModule({ imports: [AppModule] })` both load) applies this
/// process-wide, since `BigInt.prototype` is a single shared object.
if (!('toJSON' in BigInt.prototype)) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (BigInt.prototype as any).toJSON = function (this: bigint) {
    return this.toString();
  };
}
