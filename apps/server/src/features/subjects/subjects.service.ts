import { ok, type Result } from "neverthrow";
import type { AppError } from "../../utils/errors";
import type { SubjectsRepository } from "./subjects.repository";

type Subject = Awaited<ReturnType<SubjectsRepository["listAll"]>>[number];

export class SubjectsService {
  constructor(private repo: SubjectsRepository) {}

  async list(): Promise<Result<{ subjects: Subject[] }, AppError>> {
    const subjects = await this.repo.listAll();
    return ok({ subjects });
  }
}
