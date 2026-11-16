import { Router } from "express"
import { sign } from "./auth.controller"

const authRouter = Router()

authRouter.post("/", sign)

export default authRouter
