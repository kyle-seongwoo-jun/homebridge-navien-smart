import { CONNECTION_STATE_CHANGE, ConnectionState, PubSub } from '@aws-amplify/pubsub';
import { Amplify } from 'aws-amplify';
import { Hub } from 'aws-amplify/utils';
import { BehaviorSubject, filter, map, Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';

import { AwsSession } from './aws.session';
import { AWS_IOT_ENDPOINT, AWS_IOT_REGION } from './constants';
import { DeviceEvent } from './interfaces';

// this is required because of mqtt lib is designed for browser and it uses global.WebSocket
// see https://github.com/awslabs/aws-mobile-appsync-sdk-js/issues/294
global.WebSocket = WebSocket;

export class AwsPubSub {
  private readonly _pubsub: PubSub;
  private readonly _connectionStateSubject = new BehaviorSubject<ConnectionState>(ConnectionState.Disconnected);

  constructor(homeSeq: number, awsSession: AwsSession) {
    // set aws session
    this.setSession(awsSession);

    // handle connection state change event
    Hub.listen('pubsub', (data) => {
      const { payload } = data;
      if (payload.event === CONNECTION_STATE_CHANGE) {
        const { connectionState } = payload.data as { connectionState: ConnectionState };
        this._connectionStateSubject.next(connectionState);
      }
    });

    // create pubsub instance
    this._pubsub = new PubSub({
      region: AWS_IOT_REGION,
      endpoint: `wss://${AWS_IOT_ENDPOINT}/mqtt`,
      clientId: `${uuidv4()}-${homeSeq}`,
    });
  }

  public setSession(awsSession: AwsSession) {
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

  public connectionStateChanges(): Observable<ConnectionState> {
    return this._connectionStateSubject.asObservable();
  }

  public deviceStatusChanges(deviceId: string): Observable<DeviceEvent> {
    return this._pubsub.subscribe({
      topics: [
        `$aws/things/${deviceId}/shadow/name/status/get/accepted`,
        `$aws/things/${deviceId}/shadow/name/status/update/accepted`,
      ],
    }).pipe(
      // event is Record<string, unknown> type, so we double cast it
      map((event) => event as unknown as DeviceEvent),
      // ignore if it doesn't have state.reported
      filter((event) => !!event.state.reported),
    );
  }
}
