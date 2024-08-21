import { ProviderToken, Signal, computed, inject } from '@angular/core';
import {
  SignalStoreFeature,
  patchState,
  signalStoreFeature,
  withComputed,
  withMethods,
  withState,
  EmptyFeatureResult,
  WritableStateSource,
} from '@ngrx/signals';
import {
  CallState,
  getCallStateKeys,
  setError,
  setLoaded,
  setLoading,
} from './with-call-state';
import {
  setAllEntities,
  EntityId,
  addEntity,
  updateEntity,
  removeEntity,
} from '@ngrx/signals/entities';
import { EntityState, NamedEntityComputed } from './shared/signal-store-models';
import { exhaustMap, Observable, pipe, tap, Unsubscribable } from 'rxjs';
import {rxMethod} from "@ngrx/signals/rxjs-interop";
import {tapResponse} from "@ngrx/operators";
import {HttpErrorResponse} from "@angular/common/http";

export type Filter = Record<string, unknown>;
export type Entity = { id: EntityId };

function isPromise<T>(value: PromiseOrObservable<T>): value is Promise<T> {
  return value && typeof (value as Promise<T>).then === 'function';
}
function isObservable<T>(value: PromiseOrObservable<T>): value is Observable<T> {
  return value && typeof (value as Observable<T>).subscribe === 'function';
}

type PromiseOrObservable<Entity> = Promise<Entity> | Observable<Entity>;
type PromiseOrUnsubscribable<Entity> = Promise<Entity> | Unsubscribable;

export interface DataService<
E extends Entity,
F extends Filter>
{
  load(filter: F): PromiseOrObservable<Entity[]>;

  loadById(id: EntityId): PromiseOrObservable<Entity>;

  create(entity: E): PromiseOrObservable<Entity>;

  update(entity: E): PromiseOrObservable<Entity>;

  updateAll(entity: E[]): PromiseOrObservable<Entity[]>;

  delete(entity: E): PromiseOrObservable<void> ;
}

export function capitalize(str: string): string {
  return str ? str[0].toUpperCase() + str.substring(1) : str;
}

export function getDataServiceKeys(options: { collection?: string }) {
  const filterKey = options.collection
    ? `${options.collection}Filter`
    : 'filter';
  const selectedIdsKey = options.collection
    ? `selected${capitalize(options.collection)}Ids`
    : 'selectedIds';
  const selectedEntitiesKey = options.collection
    ? `selected${capitalize(options.collection)}Entities`
    : 'selectedEntities';

  const updateFilterKey = options.collection
    ? `update${capitalize(options.collection)}Filter`
    : 'updateFilter';
  const updateSelectedKey = options.collection
    ? `updateSelected${capitalize(options.collection)}Entities`
    : 'updateSelected';
  const loadKey = options.collection
    ? `load${capitalize(options.collection)}Entities`
    : 'load';

  const currentKey = options.collection
    ? `current${capitalize(options.collection)}`
    : 'current';
  const loadByIdKey = options.collection
    ? `load${capitalize(options.collection)}ById`
    : 'loadById';
  const setCurrentKey = options.collection
    ? `setCurrent${capitalize(options.collection)}`
    : 'setCurrent';
  const createKey = options.collection
    ? `create${capitalize(options.collection)}`
    : 'create';
  const updateKey = options.collection
    ? `update${capitalize(options.collection)}`
    : 'update';
  const updateAllKey = options.collection
    ? `updateAll${capitalize(options.collection)}`
    : 'updateAll';
  const deleteKey = options.collection
    ? `delete${capitalize(options.collection)}`
    : 'delete';

  // TODO: Take these from @ngrx/signals/entities, when they are exported
  const entitiesKey = options.collection
    ? `${options.collection}Entities`
    : 'entities';
  const entityMapKey = options.collection
    ? `${options.collection}EntityMap`
    : 'entityMap';
  const idsKey = options.collection ? `${options.collection}Ids` : 'ids';

  return {
    filterKey,
    selectedIdsKey,
    selectedEntitiesKey,
    updateFilterKey,
    updateSelectedKey,
    loadKey,
    entitiesKey,
    entityMapKey,
    idsKey,

    currentKey,
    loadByIdKey,
    setCurrentKey,
    createKey,
    updateKey,
    updateAllKey,
    deleteKey,
  };
}

export type NamedDataServiceState<
  E extends Entity,
  F extends Filter,
  Collection extends string
> = {
  [K in Collection as `${K}Filter`]: F;
} & {
  [K in Collection as `selected${Capitalize<K>}Ids`]: Record<EntityId, boolean>;
} & {
  [K in Collection as `current${Capitalize<K>}`]: E;
};

export type DataServiceState<E extends Entity, F extends Filter> = {
  filter: F;
  selectedIds: Record<EntityId, boolean>;
  current: E;
};

export type DataServiceComputed<E extends Entity> = {
  selectedEntities: Signal<E[]>;
};

export type NamedDataServiceComputed<
  E extends Entity,
  Collection extends string
> = {
  [K in Collection as `selected${Capitalize<K>}Entities`]: Signal<E[]>;
};

export type NamedDataServiceMethods<
  E extends Entity,
  F extends Filter,
  Collection extends string,
> = {
  [K in Collection as `update${Capitalize<K>}Filter`]: (filter: F) => void;
} & {
  [K in Collection as `updateSelected${Capitalize<K>}Entities`]: (
    id: EntityId,
    selected: boolean
  ) => void;
} & {
  [K in Collection as `load${Capitalize<K>}Entities`]: () => PromiseOrUnsubscribable<Entity>;
} & {
  [K in Collection as `setCurrent${Capitalize<K>}`]: (entity: E) => void;
} & {
  [K in Collection as `load${Capitalize<K>}ById`]: (
    id: EntityId
  ) => PromiseOrUnsubscribable<Entity>;
} & {
  [K in Collection as `create${Capitalize<K>}`]: (entity: E) => PromiseOrUnsubscribable<Entity>;
} & {
  [K in Collection as `update${Capitalize<K>}`]: (entity: E) => PromiseOrUnsubscribable<Entity>;
} & {
  [K in Collection as `updateAll${Capitalize<K>}`]: (
    entity: E[]
  ) => PromiseOrUnsubscribable<Entity>;
} & {
  [K in Collection as `delete${Capitalize<K>}`]: (entity: E) => PromiseOrUnsubscribable<Entity>;
};

export type DataServiceMethods<E extends Entity, F extends Filter> = {
  updateFilter: (filter: F) => void;
  updateSelected: (id: EntityId, selected: boolean) => void;
  load: () => PromiseOrObservable<Entity>;

  setCurrent(entity: E): void;
  loadById(id: EntityId): PromiseOrObservable<Entity>;
  create(entity: E): PromiseOrObservable<Entity>;
  update(entity: E): PromiseOrObservable<Entity>;
  updateAll(entities: E[]):PromiseOrObservable<Entity>;
  delete(entity: E): PromiseOrObservable<Entity>;
};

export function withDataService<
  E extends Entity,
  F extends Filter,
  Collection extends string
>(options: {
  dataServiceType: ProviderToken<DataService<E, F>>;
  filter: F;
  collection: Collection;
}): SignalStoreFeature<
  // These alternatives break type inference:
  // state: { callState: CallState } & NamedEntityState<E, Collection>,
  // state: NamedEntityState<E, Collection>,
  EmptyFeatureResult & { computed: NamedEntityComputed<E, Collection> },
  {
    state: NamedDataServiceState<E, F, Collection>;
    computed: NamedDataServiceComputed<E, Collection>;
    methods: NamedDataServiceMethods<E, F, Collection>;
  }
>;
export function withDataService<E extends Entity, F extends Filter>(options: {
  dataServiceType: ProviderToken<DataService<E, F>>;
  filter: F;
}): SignalStoreFeature<
  EmptyFeatureResult & { state: { callState: CallState } & EntityState<E> },
  {
    state: DataServiceState<E, F>;
    computed: DataServiceComputed<E>;
    methods: DataServiceMethods<E, F>;
  }
>;

// TODO - update these actual implementations to not just be promises
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withDataService<
  E extends Entity,
  F extends Filter,
  Collection extends string
>(options: {
  dataServiceType: ProviderToken<DataService<E, F>>;
  filter: F;
  collection?: Collection;
}): SignalStoreFeature<any, any> {
  const { dataServiceType, filter, collection: prefix } = options;
  const {
    entitiesKey,
    filterKey,
    loadKey,
    selectedEntitiesKey,
    selectedIdsKey,
    updateFilterKey,
    updateSelectedKey,

    currentKey,
    createKey,
    updateKey,
    updateAllKey,
    deleteKey,
    loadByIdKey,
    setCurrentKey,
  } = getDataServiceKeys(options);

  const { callStateKey } = getCallStateKeys({ collection: prefix });

  return signalStoreFeature(
    withState(() => ({
      [filterKey]: filter,
      [selectedIdsKey]: {} as Record<EntityId, boolean>,
      [currentKey]: undefined as E | undefined,
    })),
    withComputed((store: Record<string, unknown>) => {
      const entities = store[entitiesKey] as Signal<E[]>;
      const selectedIds = store[selectedIdsKey] as Signal<
        Record<EntityId, boolean>
      >;

      return {
        [selectedEntitiesKey]: computed(() =>
          entities().filter((e) => selectedIds()[e.id])
        ),
      };
    }),
    withMethods(
      (store: Record<string, unknown> & WritableStateSource<object>) => {
        const dataService = inject(dataServiceType);

        const _loadById = (id: EntityId): PromiseOrUnsubscribable<void> => {
          const loadCall = dataService.loadById(id);
          store[callStateKey] && patchState(store, setLoading(prefix));

          if (isPromise(loadCall)) {
            const loadPromise = async (id: EntityId) => {
              store[callStateKey] && patchState(store, setLoading(prefix));

              try {
                const current = await loadCall;
                store[callStateKey] && patchState(store, setLoaded(prefix));
                patchState(store, { [currentKey]: current });
              } catch (e) {
                store[callStateKey] && patchState(store, setError(e, prefix));
                throw e;
              }
            }
            return loadPromise(id)
          } else {
            return rxMethod<EntityId>(
              pipe(
                tap(() => {
                  store[callStateKey] && patchState(store, setLoading(prefix));
                }),
                exhaustMap((id) => {
                  return loadCall.pipe(
                    tapResponse(
                      (current) => {
                        store[callStateKey] && patchState(store, setLoaded(prefix));
                        patchState(store, { [currentKey]: current });
                      }, (errorResponse: HttpErrorResponse) => store[callStateKey] && patchState(store, setError(errorResponse, prefix))
                    )
                  );
                })
              )
            )
          }
        };
        return {
          [updateFilterKey]: (filter: F): void => {
            patchState(store, { [filterKey]: filter });
          },
          [updateSelectedKey]: (id: EntityId, selected: boolean): void => {
            patchState(store, (state: Record<string, unknown>) => ({
              [selectedIdsKey]: {
                ...(state[selectedIdsKey] as Record<EntityId, boolean>),
                [id]: selected,
              },
            }));
          },
          [loadKey]: rxMethod<void>(
            pipe(
              tap(() => {
                store[callStateKey] && patchState(store, setLoading(prefix));
              }),
              exhaustMap(() => {
                const filter = store[filterKey] as Signal<F>;
                return (dataService.load(filter()) as Observable<Entity[]>).pipe(
                  tapResponse((result) => {
                    patchState(
                      store,
                      prefix
                        ? setAllEntities(result, { collection: prefix })
                        : setAllEntities(result)
                    );
                    store[callStateKey] && patchState(store, setLoaded(prefix));
                  }, (errorResponse: HttpErrorResponse) => store[callStateKey] && patchState(store, setError(errorResponse, prefix)))
                )
              })
            )
          ),
          [loadKey]: async (): Promise<void> => {
            const filter = store[filterKey] as Signal<F>;
            store[callStateKey] && patchState(store, setLoading(prefix));

            try {
              const result = await (dataService.load(filter()) as Promise<Entity[]>);
              patchState(
                store,
                prefix
                  ? setAllEntities(result, { collection: prefix })
                  : setAllEntities(result)
              );
              store[callStateKey] && patchState(store, setLoaded(prefix));
            } catch (e) {
              store[callStateKey] && patchState(store, setError(e, prefix));
              throw e;
            }
          },
          [loadByIdKey]: (id: EntityId) => {
            const loadCall = dataService.loadById(id);
            store[callStateKey] && patchState(store, setLoading(prefix));

            return (id: EntityId): PromiseOrUnsubscribable<void> => {
              if (isPromise(loadCall)) {
                const loadPromise = async (id: EntityId) => {
                  store[callStateKey] && patchState(store, setLoading(prefix));

                  try {
                    const current = await loadCall;
                    store[callStateKey] && patchState(store, setLoaded(prefix));
                    patchState(store, { [currentKey]: current });
                  } catch (e) {
                    store[callStateKey] && patchState(store, setError(e, prefix));
                    throw e;
                  }
                }
                return loadPromise(id)
              } else {
                return rxMethod<EntityId>(
                  pipe(
                    tap(() => {
                      store[callStateKey] && patchState(store, setLoading(prefix));
                    }),
                    exhaustMap((id) => {
                      return loadCall.pipe(
                        tapResponse(
                          (current) => {
                            store[callStateKey] && patchState(store, setLoaded(prefix));
                            patchState(store, { [currentKey]: current });
                          }, (errorResponse: HttpErrorResponse) => store[callStateKey] && patchState(store, setError(errorResponse, prefix))
                        )
                      );
                    })
                  )
                )
              }
            };
          },
          [setCurrentKey]: (current: E): void => {
            patchState(store, { [currentKey]: current });
          },
          [createKey]: async (entity: E): Promise<void> => {
            patchState(store, { [currentKey]: entity });
            store[callStateKey] && patchState(store, setLoading(prefix));

            try {
              const created = await (dataService.create(entity) as Promise<Entity>);
              patchState(store, { [currentKey]: created });
              patchState(
                store,
                prefix
                  ? addEntity(created, { collection: prefix })
                  : addEntity(created)
              );
              store[callStateKey] && patchState(store, setLoaded(prefix));
            } catch (e) {
              store[callStateKey] && patchState(store, setError(e, prefix));
              throw e;
            }
          },
          [createKey]: rxMethod<E>(
            pipe(
              tap((entity) => {
                patchState(store, { [currentKey]: entity });
                store[callStateKey] && patchState(store, setLoading(prefix));
              }),
              exhaustMap((entity) => {
                return (dataService.create(entity) as Observable<Entity>).pipe(
                  tapResponse((created) => {
                    patchState(store, { [currentKey]: created });
                    patchState(
                      store,
                      prefix
                        ? addEntity(created, { collection: prefix })
                        : addEntity(created)
                    );
                    store[callStateKey] && patchState(store, setLoaded(prefix));
                  }, (errorResponse: HttpErrorResponse) => store[callStateKey] && patchState(store, setError(errorResponse, prefix)))
                )
              })
            )
          ),
          [updateKey]: async (entity: E): Promise<void> => {
            patchState(store, { [currentKey]: entity });
            store[callStateKey] && patchState(store, setLoading(prefix));

            try {
              const updated = await (dataService.update(entity) as Promise<Entity>);
              patchState(store, { [currentKey]: updated });

              const updateArg = {
                id: updated.id,
                changes: updated,
              };

              const updater = (collection: string) =>
                updateEntity(updateArg, { collection });

              patchState(
                store,
                prefix ? updater(prefix) : updateEntity(updateArg)
              );
              store[callStateKey] && patchState(store, setLoaded(prefix));
            } catch (e) {
              store[callStateKey] && patchState(store, setError(e, prefix));
              throw e;
            }
          },
          [updateKey]: rxMethod<E>(
            pipe(
              tap((entity) => {
                patchState(store, { [currentKey]: entity });
                store[callStateKey] && patchState(store, setLoading(prefix));
              }),
              exhaustMap((entity) => {
                return (dataService.update(entity) as Observable<Entity>).pipe(
                  tapResponse((updated) => {
                    patchState(store, { [currentKey]: updated });

                    const updateArg = {
                      id: updated.id,
                      changes: updated,
                    };

                    const updater = (collection: string) =>
                      updateEntity(updateArg, { collection });

                    patchState(
                      store,
                      prefix ? updater(prefix) : updateEntity(updateArg)
                    );
                    store[callStateKey] && patchState(store, setLoaded(prefix));
                  }, (error: HttpErrorResponse) => store[callStateKey] && patchState(store, setError(error, prefix)))
                )
              })
            )
          ),
          [updateAllKey]: async (entities: E[]): Promise<void> => {
            store[callStateKey] && patchState(store, setLoading(prefix));

            try {
              const result = await (dataService.updateAll(entities) as Promise<Entity[]>);
              patchState(
                store,
                prefix
                  ? setAllEntities(result, { collection: prefix })
                  : setAllEntities(result)
              );
              store[callStateKey] && patchState(store, setLoaded(prefix));
            } catch (e) {
              store[callStateKey] && patchState(store, setError(e, prefix));
              throw e;
            }
          },
          [updateAllKey]: rxMethod<E[]>(
            pipe(
              tap(() => {
                store[callStateKey] && patchState(store, setLoading(prefix));
              }),
              exhaustMap((entities) => {
                return (dataService.updateAll(entities) as Observable<Entity[]>).pipe(
                  tapResponse((result) => {
                    patchState(
                      store,
                      prefix
                        ? setAllEntities(result, { collection: prefix })
                        : setAllEntities(result)
                    );
                    store[callStateKey] && patchState(store, setLoaded(prefix));
                  }, (error: HttpErrorResponse) => store[callStateKey] && patchState(store, setError(error, prefix)))
                )
              })
            )
          ),
          [deleteKey]: async (entity: E): Promise<void> => {
            patchState(store, { [currentKey]: entity });
            store[callStateKey] && patchState(store, setLoading(prefix));

            try {
              await dataService.delete(entity);
              patchState(store, { [currentKey]: undefined });
              patchState(
                store,
                prefix
                  ? removeEntity(entity.id, { collection: prefix })
                  : removeEntity(entity.id)
              );
              store[callStateKey] && patchState(store, setLoaded(prefix));
            } catch (e) {
              store[callStateKey] && patchState(store, setError(e, prefix));
              throw e;
            }
          },
          [deleteKey]: rxMethod<E>(
            pipe(
              tap((entity) => {
                patchState(store, { [currentKey]: entity });
                store[callStateKey] && patchState(store, setLoading(prefix));
              }),
              exhaustMap((entity) => {
                return (dataService.delete(entity) as Observable<void>).pipe(
                  tapResponse(
                    (() => {
                      patchState(store, { [currentKey]: undefined });
                      patchState(
                        store,
                        prefix
                          ? removeEntity(entity.id, { collection: prefix })
                          : removeEntity(entity.id)
                      );
                      store[callStateKey] && patchState(store, setLoaded(prefix));
                    }),
                    (error: HttpErrorResponse) => store[callStateKey] && patchState(store, setError(error, prefix)),
                  )
                )
              })
            )
          )
        };
      }
    )
  );
}
