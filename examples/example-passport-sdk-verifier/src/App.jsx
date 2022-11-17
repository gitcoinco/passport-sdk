// @ts-ignore
import react, { useState , useEffect} from "react";
// @ts-ignore
import logo from "./GitcoinLogo.svg";
import "./App.css";

import * as wasmModule from '@gitcoinco/passport-sdk-verifier';

function App() {
  const [addressInput, setAddressInput] = useState("");
  const [passport, setPassport] = useState({});

  const [verifier, setVerifier] = useState();

  useEffect(() => {
    const initVerifier = async () => {
      // Dynamically load @gitcoinco/passport-sdk-verifier
      // const PassportVerifier = (await import("@gitcoinco/passport-sdk-verifier")).PassportVerifier;
      const PassportVerifier = (await wasmModule).PassportVerifier;
      setVerifier(new PassportVerifier("https://ceramic.passport-iam.gitcoin.co"));
    };
    initVerifier().then(() => {
      console.log("Verifier inited :)");
    });
  }, []);


  const handleSubmit = (event) => {
    event.preventDefault();
    verifier.verifyPassport(addressInput).then((result) => {
      setPassport(result);
    });
  };

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <h1>Passport Verifier SDK</h1>
        <p>Enter Wallet Address to verify passport</p>
        <form>
          <input
            type="text"
            name="inputAddress"
            style={{ padding: 12 }}
            // @ts-ignore
            onChange={(e) => setAddressInput(e.target.value)}
            value={addressInput}
          />
          <button style={{ padding: 12 }} onClick={handleSubmit}>
            Enter
          </button>
        </form>
        {passport && (
          <div
            style={{
              padding: 10,
              marginTop: 10,
              fontSize: 14,
              textAlign: "left",
            }}
          >
            <h1 style={{ textAlign: "center" }}>Passport Stamps</h1>
            {
              // @ts-ignore
              passport?.stamps?.length > 0 && (
                <div>
                  Stamps:{" "}
                  <ul>
                    {
                      // @ts-ignore
                      passport?.stamps?.map((item, index) => {
                        return (
                          <li key={index}>
                            {item.provider}: {item.verified ? "✅" : "❌"}
                          </li>
                        );
                      })
                    }
                  </ul>
                </div>
              )
            }
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
