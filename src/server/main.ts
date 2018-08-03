import * as http from 'http';
import * as sockjs from 'sockjs';
import { ServerManager } from './serverManager';
import { TestUserDataProvider } from './userDataProvider';

/* tslint:disable:no-console */

const sockjsServer = sockjs.createServer({
  sockjs_url: 'https://cdnjs.cloudflare.com/ajax/libs/sockjs-client/1.1.5/sockjs.min.js',
  log: (severity: string, message: string) => {
    // do nothing
  },
});
const httpServer = http.createServer();
sockjsServer.installHandlers(httpServer, { prefix: '/sockjs' });
httpServer.listen(9999, '0.0.0.0');

const userDataProvider = new TestUserDataProvider();
const nextGameID = 1;

const serverManager = new ServerManager(sockjsServer, userDataProvider, nextGameID, console.log);
serverManager.manage();
