/* eslint-disable no-console */
// add above to disable eslint for console.log only.  The console.log apparently gives the warning

require('dotenv').config();
const fs = require('fs');
const bodyParser = require('body-parser');
const express = require('express');

const octokit = require('@octokit/rest');
const nacl = require('tweetnacl');
nacl.util = require('tweetnacl-util');

const username = 'jsnavey'; // TODO: Replace with your username
// The object you'll be interfacing with to communicate with github
const github = octokit({ debug: true });
const server = express();

// Create application/x-www-form-urlencoded parser
const urlencodedParser = bodyParser.urlencoded({ extended: false });
// express.json()

// Generate an access token: https://github.com/settings/tokens
// Set it to be able to create gists
github.authenticate({
  type: 'oauth',
  token: process.env.GITHUB_TOKEN
});

// TODO:  Attempt to load the key from config.json.  If it is not found, create a new 32 byte key.
// 1. Try to read the config.json
// 2. If the config.json file exits and the key is in there, initialize`secretKey` variable
// 3. If we fail to read the config.json, generate a new random secretKey

let secretKey;  // Our secret key as UTF8 array

try {
  // try to read the config file.
  // fs = file system method, able to read the file.  Find more in `File System - Node` The config file is small and read only when the app start so it should've not affect the data. So that's why use readFileSync
  const data = fs.readFileSync('./config.json');
  // parse the data that we read from the json file
  const keyObject = JSON.parse(data);
  // secretKey = keyObject.secretKey;
  secretKey = nacl.util.decodeBase64(keyObject.secretKey);
} catch (err) {
  secretKey = nacl.randomBytes(32);
  // console.log('secretKey: ', secretKey);
  // create the keyObject
  // encoding as a string
  // console.log('secretKey Base 64: ', nacl.util.encodeBase64(secretKey));
  // console.log('secretKey UTF8: ', nacl.util.encodeUTF8(secretKey)); (there's an issue using this but not sure why)
  const keyObject = { secretKey: nacl.util.encodeBase64(secretKey) };
  // write this keyObject to config.json
  fs.writeFile('./config.json', JSON.stringify(keyObject), (ferr) => {
    if (ferr) {
      console.log('Error writing secret key to config file: ', ferr.message);
      return;
    }
  });
}

// const secretKey = nacl.randomBytes(32);

server.get('/', (req, res) => {
  // Return a response that documents the other routes/operations available
  res.send(`
    <html>
      <header><title>Secret Gists!</title></header>
      <body>
        <h1>Secret Gists!</h1>
        <div>This is an educational implementation.  Do not use for truly valuable information</div>
        <h2>Supported operations:</h2>
        <ul>
          <li><i><a href="/keyPairGen">Show Keypair</a></i>: generate a keypair from your secret key.  Share your public key for other users of this app to leave encrypted gists that only you can decode with your secret key.</li>
          <li><i><a href="/gists">GET /gists</a></i>: retrieve a list of gists for the authorized user (including private gists)</li>
          <li><i><a href="/key">GET /key</a></i>: return the secret key used for encryption of secret gists</li>
        </ul>
        <h3>Set your secret key to a specific key</h3>
        <form action="/setkey:keyString" method="get">
          Key String: <input type="text" name="keyString"><br>
          <input type="submit" value="Submit">
        </form>
        <h3>Create an *unencrypted* gist</h3>
        <form action="/create" method="post">
          Name: <input type="text" name="name"><br>
          Content:<br><textarea name="content" cols="80" rows="10"></textarea><br>
          <input type="submit" value="Submit">
        </form>
        <h3>Create an *encrypted* gist for yourself</h3>
        <form action="/createsecret" method="post">
          Name: <input type="text" name="name"><br>
          Content:<br><textarea name="content" cols="80" rows="10"></textarea><br>
          <input type="submit" value="Submit">
        </form>
        <h3>Retrieve an *encrypted* gist you posted for yourself</h3>
        <form action="/fetchmessagefromself:id" method="get">
          Gist ID: <input type="text" name="id"><br>
          <input type="submit" value="Submit">
        </form>
        <h3>Create an *encrypted* gist for a friend to decode</h3>
        <form action="/postmessageforfriend" method="post">
          Name: <input type="text" name="name"><br>
          Friend's Public Key String: <input type="text" name="publicKeyString"><br>
          Content:<br><textarea name="content" cols="80" rows="10"></textarea><br>
          <input type="submit" value="Submit">
        </form>
        <h3>Retrieve an *encrypted* gist a friend has posted</h3>
        <form action="/fetchmessagefromfriend:messageString" method="get">
          String From Friend: <input type="text" name="messageString"><br>
          <input type="submit" value="Submit">
        </form>
      </body>
    </html>
  `);
});

server.get('/keyPairGen', (req, res) => {
  // TODO:  Generate a keypair from the secretKey and display both
  // Display both keys as strings
  // this give us the public key
  const keypair = nacl.box.keyPair.fromSecretKey(secretKey);
  // display both keys as strings
  res.send(`
    <html>
      <header><title>Keypair</title></header>
      <body>
        <h1>Keypair</h1>
        <div>Share your public key with anyone you want to be able to leave you secret messages.</div>
        <div>Keep your secret key safe.  You will need it to decode messages.  Protect it like a passphrase!</div>
        <br/>
        <div>Public Key: ${nacl.util.encodeBase64(keypair.publicKey)}</div>
        <div>Secret Key: ${nacl.util.encodeBase64(keypair.secretKey)}</div>
      </body>
    </html>
  `);
});

server.get('/gists', (req, res) => {
  // Retrieve a list of all gists for the currently authed user
  github.gists.getForUser({ username })
    .then((response) => {
      res.json(response.data);
    })
    .catch((err) => {
      res.json(err);
    });
});

server.get('/key', (req, res) => {
  // TODO: Display the secret key used for encryption of secret gists
  // 1. encode our secretKey back to base64
  // 2. send it as our response
  // res.json({ JaSecretKey: nacl.util.encodeBase64(secretKey) });
  res.send(nacl.util.encodeBase64(secretKey));
});

server.get('/setkey:keyString', (req, res) => {
  // TODO: Set the key to one specified by the user or display an error if invalid
  const keyString = req.query.keyString;
  try {
    // TODO:
    // Set our secretKey var to be whateve the user pass in
    secretKey = nacl.util.decodeBase64(keyString);
    res.send(`<div>Key set to new value: ${keyString}</div>`);
  } catch (err) {
    // failed
    res.send('Failed to set key.  Key string appears invalid.');
  }
});

server.get('/fetchmessagefromself:id', (req, res) => {
  // TODO:  Retrieve and decrypt the secret gist corresponding to the given ID
  const id = req.query.id;
  github.gists.get({ id })
    .then((response) => {
      // console.log('response: ', response);
      const gist = response.data;
      // assume that the gist only contain one file
      // console.log('file: ', gist.file);
      const filename = Object.keys(gist.file)[0];
      // grab the encryped content and nonce
      const blob = gist.files[filename].content;
      // nonce is the first 24 bytes; splice that many bytes off the blob
      // 24 bytes nonce translates to 32 chars once we encode in base 64
      const nonce = nacl.util.decodeBase64(blob.slice(0, 32));
      // grab the ciphertext from the rest of the blob
      const ciphertext = nacl.util.decodeBase64(blob.slice(32, blob.length));
      // decrypt the ciphertext into plaintext
      const plaintext = nacl.secretbox.open(ciphertext, nonce, secretKey);
      // send the plaintext in the response
      res.send(nacl.util.encodeUTF8(plaintext));
    });
});

server.post('/create', urlencodedParser, (req, res) => {
  // Create a private gist with name and content given in post request
  const { name, content } = req.body;
  const files = { [name]: { content } };
  github.gists.create({ files, public: false })
    .then((response) => {
      res.json(response.data);
    })
    .catch((err) => {
      res.json(err);
    });
});

server.post('/createsecret', urlencodedParser, (req, res) => {
  // TODO:  Create a private and encrypted gist with given name/content
  // NOTE - we're only encrypting the content, not the filename
  // read the name and content off the url params
  const { name, content } = req.body;
  // initialize a nonce
  const nonce = nacl.randomBytes(24);
  // decode the UTF8 content then encrypt it
  const ciphertext = nacl.secretbox(nacl.util.decodeUTF8(content), nonce, secretKey);
  // somehow the noce needs to be persisited until we're looking to decrypt this content
  // append (or prepend) the nonce to our excrypted content
  // combined nonce in content
  const blob = nacl.util.encodeBase64(nonce) + nacl.util.encodeBase64(ciphertext);
  // format the blob and name in the format that github API expect
  const files = { [name]: { content: blob } };
  // send the post rerequest to the github API
  github.gists.create({ files, public: false })
    .then((response) => {
      res.json(response.data);
    })
    .catch((err) => {
      res.json(err);
    });
});

server.post('/postmessageforfriend', urlencodedParser, (req, res) => {
  // TODO:  Create a private and encrypted gist with given name/content
  // using someone else's public key that can be accessed and
  // viewed only by the person with the matching private key
  // NOTE - we're only encrypting the content, not the filename
  // grab the name, content, publicKeyString from params
  const keypair = nacl.box.keyPair.fromSecretKey(secretKey);
  const { name, content, publicKeyString } = req.body;
  const nonce = nacl.randomBytes(24);
  const ciphertext = nacl.box(nacl.util.decodeUTF8(content), nonce,
    nacl.util.decodeBase64(publicKeyString), secretKey);
  // To save, we need to keep both encrypted content and nonce
  const blob = nacl.util.encodeBase64(nonce) + nacl.util.encodeBase64(ciphertext);
  const files = { [name]: { content: blob } };
  github.gists.create({ files, public: true })
    .then((response) => {
      // Display a string that is the messager's public key + encrypted message blob
      // to share with the friend.
      const messageString = nacl.util.encodeBase64(keypair.publicKey) + response.data.id;
      res.send(`
        <html>
          <header><title>Message Saved</title></header>
          <body>
            <h1>Message Saved</h1>
            <div>Give this string to your friend for decoding.</div>
            <div>${messageString}</div>
            <div>
          </body>
        </html>
      `);
    })
    .catch((err) => {
      if (err) {
        res.json(err);
      }
    });
});

server.get('/fetchmessagefromfriend:messageString', urlencodedParser, (req, res) => {
  // TODO:  Retrieve and decrypt the secret gist corresponding to the given ID
  // fetch the messageString
  const messageString = req.params.messageString;
  // slice out the friend's public key
  const friendPublicString = messageString.slice(0, 44);
  const id = messageString.slice(44, messageString.length);

  github.gists.get({ id })
    .then((response) => {
      const gist = response.data;
      // Assuming gist has only 1 file and/or we only care about that file
      const filename = Object.keys(gist.files)[0];
      const blob = gist.files[filename].content;
    // Assume nonce is first 24 bytes of blob, split and decrypt remainder
    // N.B. 24 byte nonce == 32 characters encoded in Base64
      const nonce = nacl.util.decodeBase64(blob.slice(0, 32));
      const ciphertext = nacl.util.decodeBase64(blob.slice(32, blob.length));
      const plaintext = nacl.box.open(ciphertext, nonce,
        nacl.util.decodeBase64(friendPublicString),
        secretKey
      );
      res.send(nacl.util.encodeUTF8(plaintext));
    });
});

/* OPTIONAL - if you want to extend functionality */
server.post('/login', (req, res) => {
  // TODO log in to GitHub, return success/failure response
  // This will replace hardcoded username from above
  // const { username, oauth_token } = req.body;
  res.json({ success: false });
});

/*
  Still want to write code? Some possibilities:
  - Pretty templates! More forms!
  - Better management of gist IDs, use/display other gist fields
  - Support editing/deleting existing gists
  - Switch from symmetric to asymmetric crypto
  - Exchange keys, encrypt messages for each other, share them
  - Let the user pass in their private key via POST
*/


server.listen(3000, () => console.log('listening on port 3000'));
