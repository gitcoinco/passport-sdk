/* eslint no-console: ["error", { allow: ["error"] }] */

// -- Types
import { DID, Passport, Stamp } from "@gitcoinco/passport-sdk-types";

// -- Model
import testnetPassportModel from "./passportModel.testnet.json";
// import mainnetPassportModel from "./passportModel.mainnet.json";

// -- Ceramic and Glazed
import type { CeramicApi } from "@ceramicnetwork/common";
import type { DID as CeramicDID } from "dids";

import { CeramicClient } from "@ceramicnetwork/http-client";
import { DataModel } from "@glazed/datamodel";
import { DIDDataStore } from "@glazed/did-datastore";
import { TileLoader } from "@glazed/tile-loader";

import { CeramicPassport, DataStorageBase, ModelTypes } from "./types";

// Ceramic Testnet URL - must use with testnet passportModel
const CERAMIC_CLIENT_TESTNET_URL = "https://ceramic-clay.3boxlabs.com";

// Ceramic Mainnet URL - must use with mainnet passportModel
// const CERAMIC_CLIENT_MAINNET_URL = "https://ceramic.passport-iam.gitcoin.co";

export class PassportWriter implements DataStorageBase {
  did: string;
  loader: TileLoader;
  ceramicClient: CeramicApi;
  model: DataModel<ModelTypes>;
  store: DIDDataStore<ModelTypes>;

  constructor(did?: CeramicDID, ceramicHost?: string) {
    // Create the Ceramic instance and inject the DID
    const ceramic = new CeramicClient(ceramicHost ?? CERAMIC_CLIENT_TESTNET_URL);
    ceramic.setDID(did).catch((e) => {
      console.error(e);
    });

    // Create the loader, model and store
    const loader = new TileLoader({ ceramic });
    const model = new DataModel({ ceramic, aliases: testnetPassportModel });
    const store = new DIDDataStore({ loader, ceramic, model });

    // Store the users did:pkh here to verify match on credential
    this.did = (did.hasParent ? did.parent : did.id).toLowerCase();

    // Store state into class
    this.loader = loader;
    this.ceramicClient = ceramic;
    this.model = model;
    this.store = store;
  }

  async createPassport(): Promise<DID> {
    const date = new Date();
    const newPassport: CeramicPassport = {
      issuanceDate: date.toISOString(),
      expiryDate: date.toISOString(),
      stamps: [],
    };
    const stream = await this.store.set("Passport", { ...newPassport });
    return stream.toUrl();
  }

  async getPassport(): Promise<Passport | undefined> {
    try {
      const passport = await this.store.get("Passport");
      if (!passport) return undefined;
      // `stamps` is stored as ceramic URLs - must load actual VC data from URL
      const stampsToLoad =
        passport?.stamps.map(async (_stamp) => {
          const { provider, credential } = _stamp;
          const loadedCred = await this.loader.load(credential);
          return {
            provider,
            credential: loadedCred.content,
          } as Stamp;
        }) ?? [];
      const loadedStamps = await Promise.all(stampsToLoad);

      const parsePassport: Passport = {
        issuanceDate: new Date(passport.issuanceDate),
        expiryDate: new Date(passport.expiryDate),
        stamps: loadedStamps,
      };

      return parsePassport;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }

  async addStamp(stamp: Stamp): Promise<void> {
    // get passport document from user did data store in ceramic
    const passport = await this.store.get("Passport");

    // ensure the users did matches the credentials subject id otherwise skip the save
    if (passport && this.did === stamp.credential.credentialSubject.id.toLowerCase()) {
      // create a tile for verifiable credential issued from iam server
      const newStampTile = await this.model.createTile("VerifiableCredential", stamp.credential);

      // add stamp provider and streamId to passport stamps array
      const newStamps = passport?.stamps.concat({ provider: stamp.provider, credential: newStampTile.id.toUrl() });

      // merge new stamps array to update stamps on the passport
      await this.store.merge("Passport", { stamps: newStamps });
    }
  }

  async deletePassport(): Promise<void> {
    // Created for development purposes
    await this.store.remove("Passport");
  }
}
