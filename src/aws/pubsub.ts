import { CONNECTION_STATE_CHANGE, ConnectionState, PubSub } from '@aws-amplify/pubsub';
import { Amplify } from 'aws-amplify';
import { Hub } from 'aws-amplify/utils';
import EventEmitter from 'events';
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';

import { AwsSession } from './aws.session';
import { AWS_IOT_ENDPOINT, AWS_IOT_REGION } from './constants';

// this is required because of mqtt lib is designed for browser and it uses global.WebSocket
// see https://github.com/awslabs/aws-mobile-appsync-sdk-js/issues/294
global.WebSocket = WebSocket;

class AwsPubSubConnectionEvent extends EventEmitter {
  constructor() {
    super();

    // connection state change event
    Hub.listen('pubsub', (data) => {
      const { payload } = data;
      if (payload.event === CONNECTION_STATE_CHANGE) {
        const { connectionState } = payload.data as { connectionState: ConnectionState };
        this.emit('connection_state_changed', connectionState);
      }
    });
  }
}

export class AwsPubSub {
  private readonly pubsub: PubSub;
  private readonly connectionEvent: AwsPubSubConnectionEvent = new AwsPubSubConnectionEvent();

  constructor(familySeq: number, awsSession: AwsSession) {
    this.setSession(awsSession);
    this.pubsub = new PubSub({
      region: AWS_IOT_REGION,
      endpoint: `wss://${AWS_IOT_ENDPOINT}/mqtt`,
      clientId: `${uuidv4()}-${familySeq}`,
    });
  }

  setSession(awsSession: AwsSession) {
    Amplify.configure({}, {
      Auth: {
        credentialsProvider: {
          async getCredentialsAndIdentityId() {
            return {
              credentials: awsSession,
            };
          },
          clearCredentialsAndIdentityId() {
            // do nothing
          },
        },
      },
    });
  }

  onConnectionStateChanged(callback: (connectionState: ConnectionState) => void) {
    this.connectionEvent.on('connection_state_changed', callback);
  }

  subscribeToDeviceEvent(deviceId: string, callback: (event: Record<string, unknown>) => void) {
    this.pubsub.subscribe({
      topics: [
        `$aws/things/${deviceId}/shadow/name/status/get/accepted`,
        `$aws/things/${deviceId}/shadow/name/status/update/accepted`,
      ],
    }).subscribe(callback);
  }
}
