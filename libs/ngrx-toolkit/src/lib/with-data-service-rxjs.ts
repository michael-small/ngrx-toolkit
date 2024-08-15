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
import { exhaustMap, Observable, pipe, tap } from 'rxjs';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';

export type EntityState<Entity> = {
  entityMap: Record<EntityId, Entity>;
  ids: EntityId[];
};

export type EntityComputed<Entity> = {
  entities: Signal<Entity[]>;
};

export type NamedEntityComputed<Entity, Collection extends string> = {
  [K in keyof EntityComputed<Entity> as `${Collection}${Capitalize<K>}`]: EntityComputed<Entity>[K];
};

export type Filter = Record<string, unknown>;
export type Entity = { id: EntityId };

export interface DataService<E extends Entity, F extends Filter> {
  load(filter: F): Observable<E[]>;
  loadById(id: EntityId): Observable<E>;

  create(entity: E): Observable<E>;
  update(entity: E): Observable<E>;
  updateAll(entity: E[]): Observable<E[]>;
  delete(entity: E): Observable<void>;
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
  Collection extends string
> = {
  [K in Collection as `update${Capitalize<K>}Filter`]: (filter: F) => void;
} & {
  [K in Collection as `updateSelected${Capitalize<K>}Entities`]: (
    id: EntityId,
    selected: boolean
  ) => void;
} & {
  [K in Collection as `load${Capitalize<K>}Entities`]: () => Observable<void>;
} & {
  [K in Collection as `setCurrent${Capitalize<K>}`]: (entity: E) => void;
} & {
  [K in Collection as `load${Capitalize<K>}ById`]: (
    id: EntityId
  ) => Observable<void>;
} & {
  [K in Collection as `create${Capitalize<K>}`]: (
    entity: E
  ) => Observable<void>;
} & {
  [K in Collection as `update${Capitalize<K>}`]: (
    entity: E
  ) => Observable<void>;
} & {
  [K in Collection as `updateAll${Capitalize<K>}`]: (
    entity: E[]
  ) => Observable<void>;
} & {
  [K in Collection as `delete${Capitalize<K>}`]: (
    entity: E
  ) => Observable<void>;
};

export type DataServiceMethods<E extends Entity, F extends Filter> = {
  updateFilter: (filter: F) => void;
  updateSelected: (id: EntityId, selected: boolean) => void;
  load: () => Observable<void>;

  setCurrent(entity: E): void;
  loadById(id: EntityId): Observable<void>;
  create(entity: E): Observable<void>;
  update(entity: E): Observable<void>;
  updateAll(entities: E[]): Observable<void>;
  delete(entity: E): Observable<void>;
};

export function withDataServiceRXJS<
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
export function withDataServiceRXJS<
  E extends Entity,
  F extends Filter
>(options: {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withDataServiceRXJS<
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
        return {
          [deleteKey]: rxMethod<E>(
            pipe(
              tap((entity) => {
                patchState(store, { [currentKey]: entity });
                store[callStateKey] && patchState(store, setLoading(prefix));
              }),
              exhaustMap((entity) => {
                return dataService.delete(entity).pipe();
              })
            )
          ),
        };
      }
    )
  );
}
