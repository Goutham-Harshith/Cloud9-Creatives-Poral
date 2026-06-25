import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { UpdateAppSettingsDto } from './dto/update-app-settings.dto';

const SETTINGS_ID = 'app_settings';

const DEFAULT_SETTINGS = {
  natural12x12: '',
  natural14x15: '',
  white12x12: '',
  white14x15: '',
  print: '',
  doublePrint: '',
  fullPrint: '',
  singlePrintBulk: '',
  doublePrintBulk: '',
  fullPrintBulk: '',
  labour: '',
  current: '',
  machineDip: '',
  thread: '',
  naturalHandle: '',
  whiteHandle: '',
  naturalInnerRope: '',
  whiteInnerRope: '',
  Dhori: '',
  bambooHandle: '',
  zip: '',
  velcro: '',
  button: '',
  miscellaneous: '',
  naturalJuco: '',
  whiteJuco: '',
  jucoPrint: '',
  jucoDoublePrint: '',
  jucoFullPrint: '',
  jucoSinglePrintBulk: '',
  jucoDoublePrintBulk: '',
  jucoFullPrintBulk: '',
  jucoLabour: '',
  jucoCurrent: '',
  jucoMachineDip: '',
  jucoThread: '',
  jucoNaturalHandle: '',
  jucoWhiteHandle: '',
  jucoNaturalInnerRope: '',
  jucoWhiteInnerRope: '',
  jucoDhori: '',
  jucoBambooHandle: '',
  jucoZip: '',
  jucoVelcro: '',
  jucoButton: '',
  jucoMiscellaneous: '',
  mini: '',
  small: '',
  medium: '',
  packing: '',
  currentCapacity: '',
  version: '',
  withinStateCourier: '',
  otherStateCourier: '',
  cottonCost: '',
  cottonSquareInch: '',
  cottonSinglePrint: '',
  cottonDoublePrint: '',
  cottonLabour: '',
  cottonCurrent: '',
  cottonMachineDip: '',
  cottonThread: '',
  cottonShortHandle: '',
  cottonLongHandle: '',
  cottonSmallTapeHandle: '',
  cottonLongTapeHandle: '',
  cottonMiscellaneous: '',
  canvasCost: '',
  canvasSquareInch: '',
  canvasSinglePrint: '',
  canvasDoublePrint: '',
  canvasFullPrint: '',
  canvasLabour: '',
  canvasCurrent: '',
  canvasMachineDip: '',
  canvasThread: '',
  canvasTapeHandle: '',
  canvasRopeHandle: '',
  canvasMiscellaneous: '',
  canvasZip: '',
  canvasVelcro: '',
  combinationLabour: '',
  combinationMiscellaneous: '',
  naturalSquareInch: '',
};

@Injectable()
export class AppSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async find() {
    const settings = await this.prisma.appSettings.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: {
        id: SETTINGS_ID,
        value: DEFAULT_SETTINGS,
      },
    });

    return this.normalizeSettings(settings.value);
  }

  async update(updateAppSettingsDto: UpdateAppSettingsDto) {
    const normalizedSettings = this.normalizeSettings(updateAppSettingsDto);
    const settings = await this.prisma.appSettings.upsert({
      where: { id: SETTINGS_ID },
      update: {
        value: normalizedSettings as unknown as Prisma.InputJsonValue,
      },
      create: {
        id: SETTINGS_ID,
        value: normalizedSettings as unknown as Prisma.InputJsonValue,
      },
    });

    return settings.value;
  }

  private normalizeSettings(settings: unknown) {
    const value = settings as Record<string, unknown> | null | undefined;

    return Object.fromEntries(
      Object.entries(DEFAULT_SETTINGS).map(([key, defaultValue]) => [
        key,
        this.normalizeTextValue(value?.[key] ?? defaultValue),
      ]),
    );
  }

  private normalizeTextValue(value: unknown): string {
    return value === null || value === undefined ? '' : String(value);
  }
}




