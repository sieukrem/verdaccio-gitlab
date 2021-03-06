import path from 'path';

import { yellow, green, blue, magenta } from 'kleur';
import NodeEnvironment from 'jest-environment-node';

import { VerdaccioConfig } from '../../lib/verdaccio-server';
import VerdaccioProcess from '../../lib/server_process';
import Server from '../../lib/server';
import { IServerBridge } from '../../types';
import { PORT_GITLAB_EXPRESS_MOCK, DOMAIN_SERVERS, PORT_SERVER_1 } from '../config.functional';

import GitlabServer from './mock_gitlab_server';

class FunctionalEnvironment extends NodeEnvironment {
  private config: any;

  public constructor(config: any) {
    super(config);
  }

  public async startWeb() {
    const gitlab: any = new GitlabServer();

    return await gitlab.start(PORT_GITLAB_EXPRESS_MOCK);
  }

  public async setup() {
    const SILENCE_LOG = !process.env.VERDACCIO_DEBUG;
    // @ts-ignore
    const DEBUG_INJECT: boolean = process.env.VERDACCIO_DEBUG_INJECT ? process.env.VERDACCIO_DEBUG_INJECT : false;
    const forkList: any[] = [];
    const serverList: IServerBridge[] = [];
    const pathStore = path.join(__dirname, '../store');
    const listServers = [
      {
        port: PORT_SERVER_1,
        config: '/config-1.yaml',
        storage: '/test-storage1',
      }
    ];
    console.log(green('Setup Verdaccio Servers'));

    const app = await this.startWeb();
    this.global.__GITLAB_SERVER__ = app;

    for (const config of listServers) {
      const verdaccioConfig = new VerdaccioConfig(
        path.join(pathStore, config.storage),
        path.join(pathStore, config.config),
        `http://${DOMAIN_SERVERS}:${config.port}/`, config.port);
      console.log(magenta(`Running registry ${config.config} on port ${config.port}`));
      const server: IServerBridge = new Server(verdaccioConfig.domainPath);
      serverList.push(server);
      const process = new VerdaccioProcess(verdaccioConfig, server, SILENCE_LOG, DEBUG_INJECT);

      const fork = await process.init();
      console.log(blue(`Fork PID ${fork[1]}`));
      forkList.push(fork);
    }

    this.global.__SERVERS_PROCESS__ = forkList;
    this.global.__SERVERS__ = serverList;
  }

  public async teardown() {
    await super.teardown();
    console.log(yellow('Teardown Test Environment.'));

    if (!this.global.__SERVERS_PROCESS__) {
      throw new Error("There are no servers to stop");
    }

    // shutdown verdaccio
    for (const server of this.global.__SERVERS_PROCESS__) {
      server[0].stop();
    }
    // close web server
    this.global.__GITLAB_SERVER__.server.close();
  }

  private runScript(script: string) {
    return super.runScript(script);
  }
}

module.exports = FunctionalEnvironment;
