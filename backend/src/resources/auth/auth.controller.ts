import { type Request, type Response, type NextFunction } from "express"
import { signService } from "./auth.service.js"
import { type signDto } from "./auth.types.js"

export async function sign(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userData = req.body as signDto
    const newUser = await signService(userData)
    res.status(201).json(newUser)
  } catch (errr) {
    next(errr)
  }
}
