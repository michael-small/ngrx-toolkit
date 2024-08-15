import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, firstValueFrom, of } from 'rxjs';
import { EntityId } from '@ngrx/signals/entities';
import { Flight } from './flight';
import { Entity, Filter } from 'ngrx-toolkit';

export interface DataService<E extends Entity, F extends Filter> {
  load(filter: F): Observable<E[]>;
  loadById(id: EntityId): Observable<E>;

  create(entity: E): Observable<E>;
  update(entity: E): Observable<E>;
  updateAll(entity: E[]): Observable<E[]>;
  delete(entity: E): Observable<void>;
}

export type FlightFilter = {
  from: string;
  to: string;
};

@Injectable({
  providedIn: 'root',
})
export class FlightServiceRXJS implements DataService<Flight, FlightFilter> {
  private url = 'http://localhost:3000/books';
  private http = inject(HttpClient);

  loadById(id: EntityId): Observable<Flight> {
    const reqObj = { params: new HttpParams().set('id', id) };
    return this.http
      .get<Flight>(this.url, reqObj)
      .pipe(catchError((_) => of<Flight>()));
  }

  create(entity: Flight): Observable<Flight> {
    return this.http
      .post<Flight>(this.url, entity)
      .pipe(catchError((_) => of<Flight>()));
  }

  update(entity: Flight): Observable<Flight> {
    return this.http
      .post<Flight>(this.url, entity)
      .pipe(catchError((_) => of<Flight>()));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  updateAll(entity: Flight[]): Observable<Flight[]> {
    throw new Error('updateAll method not implemented.');
  }

  delete(entity: Flight): Observable<void> {
    return this.http
      .delete<void>(`${this.url}/${entity.id}`)
      .pipe(catchError((_) => of<void>()));
  }

  load(filter: FlightFilter): Observable<Flight[]> {
    console.log('loading');
    // TODO - actually add in filter
    return this.http
      .get<Flight[]>(this.url)
      .pipe(catchError((_) => of<Flight[]>([])));
  }
}
