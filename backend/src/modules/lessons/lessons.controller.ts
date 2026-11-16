import type { Request, Response } from 'express';
import { getAuthUser } from '../../shared/middlewares/ensureAuthenticated';
import { LessonsService } from './lessons.service';
import {
  createLessonSchema,
  lessonIdParamsSchema,
  listLessonsQuerySchema,
  listTeachersQuerySchema,
} from './lessons.schemas';

export class LessonsController {
  constructor(private readonly lessonsService = new LessonsService()) {}

  /** GET /teachers?arenaId= */
  listTeachers = async (req: Request, res: Response): Promise<void> => {
    const { arenaId } = listTeachersQuerySchema.parse(req.query);
    res.json({ teachers: await this.lessonsService.listTeachers(arenaId) });
  };

  /** GET /lessons?teacherId=&level=&days= (público; logado vê "isEnrolled") */
  list = async (req: Request, res: Response): Promise<void> => {
    const query = listLessonsQuerySchema.parse(req.query);
    res.json({ lessons: await this.lessonsService.listLessons(query, req.user?.id) });
  };

  /** POST /lessons — professor ou admin da arena */
  create = async (req: Request, res: Response): Promise<void> => {
    const data = createLessonSchema.parse(req.body);
    const lessons = await this.lessonsService.createLesson(getAuthUser(req), data);
    res.status(201).json({ lessons });
  };

  /** POST /lessons/:id/enroll */
  enroll = async (req: Request, res: Response): Promise<void> => {
    const { id } = lessonIdParamsSchema.parse(req.params);
    res.status(201).json({ lesson: await this.lessonsService.enroll(getAuthUser(req).id, id) });
  };

  /** DELETE /lessons/:id/enroll */
  unenroll = async (req: Request, res: Response): Promise<void> => {
    const { id } = lessonIdParamsSchema.parse(req.params);
    res.json({ lesson: await this.lessonsService.unenroll(getAuthUser(req).id, id) });
  };
}
