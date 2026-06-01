import type { GetServerSidePropsContext, GetServerSidePropsResult } from "next";
import { getServerSession } from "next-auth/next";
import type { NextApiRequest, NextApiResponse } from "next";
import { authOptions } from "../pages/api/auth/[...nextauth]";

export async function requireAdminApiSession(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user || session.user.role !== "admin") {
    res.status(403).json({ error: "Acesso negado." });
    return null;
  }

  return session;
}

export async function requireAdminPageSession(
  context: GetServerSidePropsContext,
): Promise<GetServerSidePropsResult<Record<string, never>> | null> {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session?.user || session.user.role !== "admin") {
    return {
      redirect: {
        destination: "/admin/login",
        permanent: false,
      },
    };
  }

  return null;
}
