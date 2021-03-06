import {Injectable} from '@nestjs/common';
import {Prisma, ProjectEnvironment} from '@prisma/client';
import {PrismaService} from '../../../_prisma/_prisma.service';

@Injectable()
export class EnvironmentService {
  public readonly prisma: PrismaService = new PrismaService();

  async findOne(where: Prisma.ProjectEnvironmentWhereUniqueInput) {
    return await this.prisma.projectEnvironment.findUnique({
      where,
    });
  }

  async findMany(where: Prisma.ProjectEnvironmentWhereInput) {
    return await this.prisma.projectEnvironment.findMany({
      where,
    });
  }

  async create(
    data: Prisma.ProjectEnvironmentCreateInput
  ): Promise<ProjectEnvironment> {
    return await this.prisma.projectEnvironment.create({
      data,
    });
  }

  async update(params: {
    where: Prisma.ProjectEnvironmentWhereUniqueInput;
    data: Prisma.ProjectEnvironmentUpdateInput;
  }): Promise<ProjectEnvironment> {
    const {where, data} = params;
    return await this.prisma.projectEnvironment.update({
      data,
      where,
    });
  }

  async delete(
    where: Prisma.ProjectEnvironmentWhereUniqueInput
  ): Promise<ProjectEnvironment> {
    return await this.prisma.projectEnvironment.delete({
      where,
    });
  }

  /* End */
}
