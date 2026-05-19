import { Controller, Get, Query } from "@nestjs/common";
import { runCompute } from "./compute";

@Controller()
export class AppController {
  @Get("compute")
  compute(
    @Query("width") width?: string,
    @Query("height") height?: string,
    @Query("maxIter") maxIter?: string,
  ) {
    return runCompute({ width, height, maxIter });
  }
}
