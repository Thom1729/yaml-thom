import type { Split, Join } from './string';

type BaseEventTypes = Record<string, object>;



type _GetEventType<EventTypes extends BaseEventTypes, EventName extends string> =
& (Split<EventName, '.'> extends [...(infer Rest extends [string, ...string[]]), unknown]
  ? _GetEventType<EventTypes, Join<Rest, '.'>>
  : {})
& (EventName extends keyof EventTypes
  ? EventTypes[EventName]
  : {});

type OutRec<EventTypes extends BaseEventTypes, EventName extends string> = {
  [K in string & keyof EventTypes]: { type: K } & _GetEventType<EventTypes, K>
}[keyof EventTypes & (EventName | `${EventName}.${string}`)];

type ListenerType<
  EventTypes extends BaseEventTypes,
  EventName extends string & keyof EventTypes,
> = (event: OutRec<EventTypes, EventName>) => void;






export class EventEmitter<EventTypes extends BaseEventTypes> {
  readonly listeners: [string, (event: never) => void][] = [];

  emit<EventName extends string & keyof EventTypes>(
    eventName: EventName,
    event: _GetEventType<EventTypes, EventName>,
  ) {
    for (const [selector, listener] of this.listeners) {
      if (eventName === selector || eventName.startsWith(selector + '.')) {
        listener({ ...event, type: eventName } as never);
      }
    }
  }

  addListener<EventName extends string & keyof EventTypes>(
    selector: EventName,
    listener: ListenerType<EventTypes, EventName>,
  ) {
    this.listeners.push([selector, listener]);
  }

  removeListener<EventName extends string & keyof EventTypes>(
    selector: EventName,
    listener: ListenerType<EventTypes, EventName>,
  ) {
    const index = this.listeners.findIndex(([s, l]) => s === selector && l === listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }
}
