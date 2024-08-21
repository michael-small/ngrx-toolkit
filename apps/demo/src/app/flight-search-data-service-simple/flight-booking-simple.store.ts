import { FlightService } from '../shared/flight.service';

import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';

import { withEntities } from '@ngrx/signals/entities';
import {
  withCallState,
  withDataService,
  withDataServicePromises,
  withDataServiceRXJS,
  withUndoRedo,
} from 'ngrx-toolkit';
import { Flight } from '../shared/flight';
import { FlightServicePromises } from '../shared/flight.service-promises';
import { FlightServiceRXJS } from '../shared/flight.service-rxjs';
import { map, pipe, switchMap, tap } from 'rxjs';
import { rxMethod } from '@ngrx/signals/rxjs-interop';

export const SimpleFlightBookingStore = signalStore(
  { providedIn: 'root' },
  withCallState(),
  withEntities<Flight>(),
  withDataService({
    dataServiceType: FlightService,
    filter: { from: 'Paris', to: 'New York' },
  }),
  withUndoRedo()
);
export const SimpleFlightBookingStorePromises = signalStore(
  { providedIn: 'root' },
  withCallState(),
  withEntities<Flight>(),
  withDataServicePromises({
    dataServiceType: FlightServicePromises,
    filter: { from: 'Paris', to: 'New York' },
  }),
  withUndoRedo()
);
export const SimpleFlightBookingStoreRXJS = signalStore(
  { providedIn: 'root' },
  withCallState(),
  withEntities<Flight>(),
  withDataServiceRXJS({
    dataServiceType: FlightServiceRXJS,
    filter: { from: 'Paris', to: 'New York' },
  }),
  withUndoRedo()
);

export const MyStore = signalStore(
  { providedIn: 'root', },
  withState({thing: 'hey'}),
  withMethods((store) => ({
    inputPipe: rxMethod<string>(
      pipe(
        tap((input) =>
          patchState(store, {thing: input})
        )
      ))
  })))
