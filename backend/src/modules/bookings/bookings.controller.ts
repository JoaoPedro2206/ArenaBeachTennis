import type { Request, Response } from 'express';
import { getAuthUser } from '../../shared/middlewares/ensureAuthenticated';
import { AvailabilityService } from './availability.service';
import { BookingsService } from './bookings.service';
import {
  availabilityQuerySchema,
  bookingIdParamsSchema,
  courtIdParamsSchema,
  createBookingSchema,
  listMyBookingsQuerySchema,
} from './bookings.schemas';

export class BookingsController {
  constructor(
    private readonly bookingsService = new BookingsService(),
    private readonly availabilityService = new AvailabilityService(),
  ) {}

  /** GET /courts/:courtId/availability?date=YYYY-MM-DD */
  availability = async (req: Request, res: Response): Promise<void> => {
    const { courtId } = courtIdParamsSchema.parse(req.params);
    const { date } = availabilityQuerySchema.parse(req.query);
    res.json(await this.availabilityService.getCourtAvailability(courtId, date));
  };

  /** POST /bookings */
  create = async (req: Request, res: Response): Promise<void> => {
    const data = createBookingSchema.parse(req.body);
    const booking = await this.bookingsService.create(getAuthUser(req).id, data);
    res.status(201).json({ booking });
  };

  /** POST /bookings/:id/pay — pagamento simulado */
  pay = async (req: Request, res: Response): Promise<void> => {
    const { id } = bookingIdParamsSchema.parse(req.params);
    const booking = await this.bookingsService.pay(getAuthUser(req).id, id);
    res.json({ booking });
  };

  /** PATCH /bookings/:id/cancel */
  cancel = async (req: Request, res: Response): Promise<void> => {
    const { id } = bookingIdParamsSchema.parse(req.params);
    const booking = await this.bookingsService.cancel(getAuthUser(req).id, id);
    res.json({ booking });
  };

  /** GET /bookings/me?scope=upcoming|past */
  listMine = async (req: Request, res: Response): Promise<void> => {
    const { scope } = listMyBookingsQuerySchema.parse(req.query);
    const bookings = await this.bookingsService.listMine(getAuthUser(req).id, scope);
    res.json({ bookings });
  };
}
