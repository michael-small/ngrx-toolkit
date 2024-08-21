import { AsyncPipe, JsonPipe, NgForOf, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FlightCardComponent } from '../shared/flight-card.component';
import {
  MyStore,
  SimpleFlightBookingStore,
  SimpleFlightBookingStorePromises,
  SimpleFlightBookingStoreRXJS
} from './flight-booking-simple.store';
import { MatTableModule } from '@angular/material/table';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

@Component({
  standalone: true,
  imports: [
    NgIf,
    NgForOf,
    AsyncPipe,
    JsonPipe,

    FormsModule,
    FlightCardComponent,

    MatTableModule,
    MatInputModule,
    MatButtonModule,

    RouterLink,
  ],
  selector: 'demo-flight-search',
  templateUrl: './flight-search-simple.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlightSearchSimpleComponent {
  private store = inject(SimpleFlightBookingStore);
  private storePromise = inject(SimpleFlightBookingStorePromises);
  private storeRXJS = inject(SimpleFlightBookingStoreRXJS);
  private myRxjsStore = inject(MyStore);

  from = this.store.filter.from;
  to = this.store.filter.to;
  flights = this.store.entities;
  selected = this.store.selectedEntities;
  selectedIds = this.store.selectedIds;

  loading = this.store.loading;

  canUndo = this.store.canUndo;
  canRedo = this.store.canRedo;

  ngOnInit() {
    this.store.loadById('');
    this.storePromise.loadById('');
    this.storeRXJS.loadById('');
    this.myRxjsStore.inputPipe('')
  }

  async search() {
    this.store.load();
  }

  undo(): void {
    this.store.undo();
  }

  redo(): void {
    this.store.redo();
  }

  updateCriteria(from: string, to: string): void {
    this.store.updateFilter({ from, to });
  }

  updateBasket(id: number, selected: boolean): void {
    this.store.updateSelected(id, selected);
  }
}
