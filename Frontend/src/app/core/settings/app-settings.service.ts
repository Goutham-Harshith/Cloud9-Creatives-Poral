import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

const API_BASE_URL = environment.apiBaseUrl;

export interface AppSettings {
  natural12x12: string;
  natural14x15: string;
  white12x12: string;
  white14x15: string;
  print: string;
  doublePrint: string;
  fullPrint: string;
  singlePrintBulk: string;
  doublePrintBulk: string;
  fullPrintBulk: string;
  labour: string;
  current: string;
  machineDip: string;
  thread: string;
  naturalHandle: string;
  whiteHandle: string;
  naturalInnerRope: string;
  whiteInnerRope: string;
  Dhori: string;
  bambooHandle: string;
  zip: string;
  velcro: string;
  button: string;
  miscellaneous: string;
  naturalJuco: string;
  whiteJuco: string;
  jucoPrint: string;
  jucoDoublePrint: string;
  jucoFullPrint: string;
  jucoSinglePrintBulk: string;
  jucoDoublePrintBulk: string;
  jucoFullPrintBulk: string;
  jucoLabour: string;
  jucoCurrent: string;
  jucoMachineDip: string;
  jucoThread: string;
  jucoNaturalHandle: string;
  jucoWhiteHandle: string;
  jucoNaturalInnerRope: string;
  jucoWhiteInnerRope: string;
  jucoDhori: string;
  jucoBambooHandle: string;
  jucoZip: string;
  jucoVelcro: string;
  jucoButton: string;
  jucoMiscellaneous: string;
  mini: string;
  small: string;
  medium: string;
  packing: string;
  currentCapacity: string;
  version: string;
  withinStateCourier: string;
  otherStateCourier: string;
  cottonCost: string;
  cottonSquareInch: string;
  cottonSinglePrint: string;
  cottonDoublePrint: string;
  cottonLabour: string;
  cottonCurrent: string;
  cottonMachineDip: string;
  cottonThread: string;
  cottonShortHandle: string;
  cottonLongHandle: string;
  cottonSmallTapeHandle: string;
  cottonLongTapeHandle: string;
  cottonMiscellaneous: string;
  canvasCost: string;
  canvasSquareInch: string;
  canvasSinglePrint: string;
  canvasDoublePrint: string;
  canvasFullPrint: string;
  canvasLabour: string;
  canvasCurrent: string;
  canvasMachineDip: string;
  canvasThread: string;
  canvasTapeHandle: string;
  canvasRopeHandle: string;
  canvasMiscellaneous: string;
  canvasZip: string;
  canvasVelcro: string;
  combinationLabour: string;
  combinationMiscellaneous: string;
  naturalSquareInch: string;
}

@Injectable({
  providedIn: 'root',
})
export class AppSettingsService {
  constructor(private readonly http: HttpClient) {}

  getSettings(): Observable<AppSettings> {
    return this.http.get<AppSettings>(`${API_BASE_URL}/app-settings`);
  }

  updateSettings(settings: AppSettings): Observable<AppSettings> {
    return this.http.put<AppSettings>(`${API_BASE_URL}/app-settings`, settings);
  }
}
