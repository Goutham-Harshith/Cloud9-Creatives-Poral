import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';

import { OrdersService } from './orders.service';
import { type UploadedOrderFile } from './orders.service';

const MAX_ORDER_UPLOAD_FILE_SIZE = 125 * 1024 * 1024;
const MAX_ORDER_UPLOAD_FILES = 50;
const MAX_ORDER_FIELD_SIZE = 2 * 1024 * 1024;

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  getOrders() {
    return this.ordersService.findAllForDashboard();
  }

  @Get(':id')
  getOrder(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.ordersService.updateStatus(id, status);
  }

  @Delete(':id')
  deleteOrder(@Param('id') id: string) {
    return this.ordersService.delete(id);
  }

  @Put(':id')
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: {
        fileSize: MAX_ORDER_UPLOAD_FILE_SIZE,
        files: MAX_ORDER_UPLOAD_FILES,
        fieldSize: MAX_ORDER_FIELD_SIZE,
      },
      fileFilter: (_request, file, callback) => {
        const isAccepted =
          file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';

        callback(
          isAccepted ? null : new BadRequestException('Only image and PDF files are allowed.'),
          isAccepted,
        );
      },
    }),
  )
  updateOrder(
    @Param('id') id: string,
    @Body('order') rawOrder: string,
    @UploadedFiles() files: UploadedOrderFile[],
  ) {
    if (!rawOrder) {
      throw new BadRequestException('Order payload is required.');
    }

    return this.ordersService.update(id, rawOrder, files);
  }

  @Post()
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: {
        fileSize: MAX_ORDER_UPLOAD_FILE_SIZE,
        files: MAX_ORDER_UPLOAD_FILES,
        fieldSize: MAX_ORDER_FIELD_SIZE,
      },
      fileFilter: (_request, file, callback) => {
        const isAccepted =
          file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';

        callback(
          isAccepted ? null : new BadRequestException('Only image and PDF files are allowed.'),
          isAccepted,
        );
      },
    }),
  )
  createOrder(@Body('order') rawOrder: string, @UploadedFiles() files: UploadedOrderFile[]) {
    if (!rawOrder) {
      throw new BadRequestException('Order payload is required.');
    }

    return this.ordersService.create(rawOrder, files);
  }
}
