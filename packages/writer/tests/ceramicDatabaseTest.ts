import { Passport, VerifiableCredential, Stamp, PROVIDER_ID } from "@gitcoinco/passport-sdk-types";
import { DID } from "dids";
import { Ed25519Provider } from "key-did-provider-ed25519";
import { getResolver } from "key-did-resolver";

import { PassportWriter } from "../src";

let testDID: DID;
let passportWriter: PassportWriter;

beforeAll(async () => {
  const TEST_SEED = Uint8Array.from({ length: 32 }, () => Math.floor(Math.random() * 256));

  // Create and authenticate the DID
  testDID = new DID({
    provider: new Ed25519Provider(TEST_SEED),
    resolver: getResolver(),
  });
  await testDID.authenticate();

  passportWriter = new PassportWriter(testDID);
});

afterAll(async () => {
  await passportWriter.store.remove("Passport");
});

describe("when there is no passport for the given did", () => {
  beforeEach(async () => {
    await passportWriter.store.remove("Passport");
  });

  it("createPassport creates a passport in ceramic", async () => {
    const actualPassportStreamID = await passportWriter.createPassport();

    expect(actualPassportStreamID).toBeDefined();

    const storedPassport = (await passportWriter.loader.load(actualPassportStreamID)).content;

    const formattedDate = new Date(storedPassport["issuanceDate"] as string);
    const todaysDate = new Date();

    expect(formattedDate.getDay()).toEqual(todaysDate.getDay());
    expect(formattedDate.getMonth()).toEqual(todaysDate.getMonth());
    expect(formattedDate.getFullYear()).toEqual(todaysDate.getFullYear());
    expect(storedPassport["stamps"]).toEqual([]);
  });

  it("getPassport returns undefined", async () => {
    const actualPassport = await passportWriter.getPassport();

    expect(actualPassport).toEqual(undefined);
  });
});

describe("when there is an existing passport without stamps for the given did", () => {
  const existingPassport: Passport = {
    issuanceDate: new Date("2022-01-01"),
    expiryDate: new Date("2022-01-02"),
    stamps: [],
  };

  let existingPassportStreamID;
  beforeEach(async () => {
    const stream = await passportWriter.store.set("Passport", existingPassport);
    existingPassportStreamID = stream.toUrl();
  });

  afterEach(async () => {
    await passportWriter.store.remove("Passport");
  });

  it("getPassport retrieves the passport from ceramic", async () => {
    const actualPassport = await passportWriter.getPassport();

    expect(actualPassport).toBeDefined();
    expect(actualPassport).toEqual(existingPassport);
    expect(actualPassport.stamps).toEqual([]);
  });

  it("addStamp adds a stamp to passport", async () => {
    const credential: VerifiableCredential = {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      type: ["VerifiableCredential"],
      credentialSubject: {
        id: `${passportWriter.did}`,
        "@context": [
          {
            hash: "https://schema.org/Text",
            provider: "https://schema.org/Text",
          },
        ],
        hash: "randomValuesHash",
        provider: "randomValuesProvider",
      },
      issuer: "did:key:randomValuesIssuer",
      issuanceDate: "2022-04-15T21:04:01.708Z",
      proof: {
        type: "Ed25519Signature2018",
        proofPurpose: "assertionMethod",
        verificationMethod: "did:key:randomValues",
        created: "2022-04-15T21:04:01.708Z",
        jws: "randomValues",
      },
      expirationDate: "2022-05-15T21:04:01.708Z",
    };

    const googleStampFixture: Stamp = {
      provider: "Google",
      credential,
    };

    await passportWriter.addStamp(googleStampFixture);
    const passport = await passportWriter.store.get("Passport");
    const retrievedStamp = passport?.stamps[0];

    // retrieve streamId stored in credential to load verifiable credential
    const loadedCred = await passportWriter.loader.load(retrievedStamp.credential);

    expect(passport.stamps.length).toEqual(1);
    expect(loadedCred.content as VerifiableCredential).toEqual(credential);
    expect(retrievedStamp.provider as PROVIDER_ID).toEqual(googleStampFixture.provider);
  });
});

describe("when there is an existing passport with stamps for the given did", () => {
  const existingPassport: Passport = {
    issuanceDate: new Date("2022-01-01"),
    expiryDate: new Date("2022-01-02"),
    stamps: [],
  };

  const credential: VerifiableCredential = {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    type: ["VerifiableCredential"],
    credentialSubject: {
      id: "",
      "@context": [
        {
          hash: "https://schema.org/Text",
          provider: "https://schema.org/Text",
        },
      ],
      hash: "randomValuesHash",
      provider: "randomValuesProvider",
    },
    issuer: "did:key:randomValuesIssuer",
    issuanceDate: "2022-04-15T21:04:01.708Z",
    proof: {
      type: "Ed25519Signature2018",
      proofPurpose: "assertionMethod",
      verificationMethod: "did:key:randomValues",
      created: "2022-04-15T21:04:01.708Z",
      jws: "randomValues",
    },
    expirationDate: "2022-05-15T21:04:01.708Z",
  };

  const ensStampFixture: Stamp = {
    provider: "Ens",
    credential,
  };

  const googleStampFixture: Stamp = {
    provider: "Google",
    credential,
  };

  let existingPassportStreamID;
  beforeEach(async () => {
    // sets credential.credentialSubject.id at runtime
    credential.credentialSubject.id = `${passportWriter.did}`;
    // create a tile for verifiable credential issued from iam server
    const ensStampTile = await passportWriter.model.createTile("VerifiableCredential", credential);
    // add ENS stamp provider and streamId to passport stamps array
    const existingPassportWithStamps = {
      ...existingPassport,
      stamps: [
        {
          provider: ensStampFixture.provider,
          credential: ensStampTile.id.toUrl(),
        },
      ],
    };

    const stream = await passportWriter.store.set("Passport", existingPassportWithStamps);
    existingPassportStreamID = stream.toUrl();
  });

  afterEach(async () => {
    await passportWriter.store.remove("Passport");
  });

  it("getPassport retrieves the passport and stamps from ceramic", async () => {
    const actualPassport = await passportWriter.getPassport();

    const formattedDate = new Date(actualPassport["issuanceDate"]);

    expect(actualPassport).toBeDefined();
    expect(formattedDate.getDay()).toEqual(existingPassport.issuanceDate.getDay());
    expect(formattedDate.getMonth()).toEqual(existingPassport.issuanceDate.getMonth());
    expect(formattedDate.getFullYear()).toEqual(existingPassport.issuanceDate.getFullYear());
    expect(actualPassport.stamps[0]).toEqual(ensStampFixture);
  });

  it("addStamp adds a stamp to passport", async () => {
    await passportWriter.addStamp(googleStampFixture);

    const passport = await passportWriter.store.get("Passport");

    const retrievedStamp = passport?.stamps[1];

    // retrieve streamId stored in credential to load verifiable credential
    const loadedCred = await passportWriter.loader.load(retrievedStamp.credential);

    expect(passport.stamps.length).toEqual(2);
    expect(loadedCred.content as VerifiableCredential).toEqual(credential);
    expect(retrievedStamp.provider as PROVIDER_ID).toEqual(googleStampFixture.provider);
  });
});
