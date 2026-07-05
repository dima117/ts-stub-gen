import type { Account, Response } from "./_input";

export function GetStubAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "",
    test: 111,
    int: { foo: 0, bar: "", boo: false, test: "test", testnum: 1234, testbool: false, testUnion: "one" },
    ...overrides,
  };
}

export function GetStubResponse(overrides: Partial<Response> = {}): Response {
  return {
    aaa: 0,
    account: GetStubAccount(),
    id: "",
    bbb: { name: "", age: 0 },
    ...overrides,
  };
}
