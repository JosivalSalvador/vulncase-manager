// import { prisma } from "../../lib/prisma.js"
// import { type signDto, type loginDto } from "./auth.types.js"
// import { type User } from "../../generated/prisma/client.js"

// export async function signService(user: signDto): Promise<User> {
//   const newUser = await prisma.user.create({ data: user })
//   return newUser
// }

// export async function loginService(userData: loginDto): Promise<User | null> {
//   const user = await prisma.user.findUnique({
//     where: {
//       email: userData.email,
//     },
//   })

//   if (!user) {
//     return null
//   }
//   return user
// }
