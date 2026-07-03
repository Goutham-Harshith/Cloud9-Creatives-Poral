import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Put,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrdersService } from './orders.service';
import { type AuthenticatedUser, type UploadedOrderFile } from './orders.service';

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

  @Get('capacity')
  getCapacity(@Query('from') from?: string, @Query('to') to?: string) {
    return this.ordersService.findCapacityReservations(from, to);
  }

  @Get(':id')
  getOrder(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Get(':id/artifacts')
  @UseGuards(JwtAuthGuard)
  getArtifacts(@Param('id') id: string) {
    return this.ordersService.findArtifacts(id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Req() request: Request & { user?: AuthenticatedUser },
  ) {
    return this.ordersService.updateStatus(id, status, request.user);
  }

  @Patch(':id/complete')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('completionProof', {
      limits: {
        fileSize: MAX_ORDER_UPLOAD_FILE_SIZE,
      },
      fileFilter: (_request, file, callback) => {
        const isAccepted = file.mimetype.startsWith('image/');

        callback(
          isAccepted ? null : new BadRequestException('Only image files are allowed.'),
          isAccepted,
        );
      },
    }),
  )
  completeOrder(
    @Param('id') id: string,
    @UploadedFile() completionProof?: UploadedOrderFile,
    @Req() request?: Request & { user?: AuthenticatedUser },
  ) {
    if (!completionProof) {
      throw new BadRequestException('Completion proof image is required.');
    }

    return this.ordersService.completeWithProof(id, completionProof, request?.user);
  }

  @Delete(':id')
  deleteOrder(@Param('id') id: string) {
    return this.ordersService.delete(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
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
    @Req() request: Request & { user?: AuthenticatedUser },
  ) {
    if (!rawOrder) {
      throw new BadRequestException('Order payload is required.');
    }

    return this.ordersService.update(id, rawOrder, files, request.user);
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
