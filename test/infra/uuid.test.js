const uuid = require('../../src/infra/uuid');

test('isValid', () => {
  expect(uuid.validate('00000000-0000-0000-0000-000000000000')).toBe(true);
  expect(uuid.validate('cfbeb8b6-dfce-4c33-a9de-acb715e82388')).toBe(true);
  expect(uuid.validate('39f5f864-3439-4ec0-9420-f54a77cb51a1')).toBe(true);
  expect(uuid.validate('1eb17906-64b4-4330-19a6-1ab37ccb9522')).toBe(true);
  expect(uuid.validate('1eb156c0-4cfa-4360-bd6c-cd70e09707b5')).toBe(true);

  const uuidV1 = uuid.v1();
  expect(uuid.validate(uuidV1)).toBe(true);

  const uuidV4 = uuid.v4();
  expect(uuid.validate(uuidV4)).toBe(true);

  const uuidV4c = uuid.v4c();
  expect(uuid.validate(uuidV4c)).toBe(true);

  const uuidV5 = uuid.v5('Hello, World!', '1b671a64-40d5-491e-99b0-da01ff1f3341');
  expect(uuid.validate(uuidV5)).toBe(true);

  const uuidV6 = uuid.v6();
  expect(uuid.validate(uuidV6)).toBe(true);
});
