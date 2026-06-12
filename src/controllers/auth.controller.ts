import type { Request, Response } from "express";
import { loginSchema, registerSchema } from "../schemas/auth.schema";
import { getMe, loginUser, registerUser } from "../services/auth.service";

export async function register(req: Request, res: Response) {
	const data = await registerSchema.parseAsync(req.body);
	const { user, token } = await registerUser(data);
	// Password is already stripped in the service — safe to send directly
	res.status(201).json({ user, token });
}

export async function login(req: Request, res: Response) {
	const data = await loginSchema.parseAsync(req.body);
	const { user, token } = await loginUser(data);
	res.status(200).json({ user, token });
}

export async function logout(_req: Request, res: Response) {
	res.status(200).json({ message: "Déconnexion réussie" });
}

export async function me(req: Request, res: Response) {
	const user = await getMe(req.userId);
	res.status(200).json({ user });
}
