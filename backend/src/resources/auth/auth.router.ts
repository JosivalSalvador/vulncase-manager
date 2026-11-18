import { Router } from "express"

import { validate } from "../../middlewares/validate.js"
import { login, logout, me, register } from "./auth.controller.js"
import { loginSchema, registerSchema } from "./auth.schema.js"

const authRouter: Router = Router()

authRouter.post("/register", validate({ body: registerSchema }), register)
authRouter.post("/login", validate({ body: loginSchema }), login)
authRouter.post("/logout", logout)
authRouter.get("/me", me)

export default authRouter
