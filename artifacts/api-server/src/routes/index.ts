import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import storageRouter from "./storage";
import usersRouter from "./users";
import postsRouter from "./posts";
import trendsRouter from "./trends";
import newsRouter from "./news";
import uploadsRouter from "./uploads";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(storageRouter);
router.use(usersRouter);
router.use(postsRouter);
router.use(trendsRouter);
router.use(newsRouter);
router.use(uploadsRouter);
router.use(aiRouter);

export default router;
