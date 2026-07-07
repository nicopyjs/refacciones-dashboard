import { NextRequest, NextResponse } from "next/server";
import { getAllComments, addComment, deleteComment } from "@/lib/comments";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  try {
    const comments = await getAllComments();
    return NextResponse.json({ comments });
  } catch {
    return NextResponse.json({ error: "No se pudieron cargar los comentarios." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const date = body?.date;
  const author = body?.author;
  const text = body?.text;
  const site = body?.site;

  if (typeof date !== "string" || !DATE_RE.test(date)) {
    return NextResponse.json({ error: "Fecha inválida." }, { status: 400 });
  }
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "El comentario no puede estar vacío." }, { status: 400 });
  }

  const authorName = typeof author === "string" && author.trim() ? author.trim() : "Anónimo";
  const siteName = typeof site === "string" && site.trim() ? site.trim() : null;
  try {
    const comment = await addComment(date, authorName, text.trim(), siteName);
    return NextResponse.json({ comment });
  } catch {
    return NextResponse.json({ error: "No se pudo guardar el comentario." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const id = searchParams.get("id");
  if (!date || !id) {
    return NextResponse.json({ error: "Falta fecha o id." }, { status: 400 });
  }
  try {
    await deleteComment(date, id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo borrar el comentario." }, { status: 500 });
  }
}
