import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import { deliverWeeklyReportForOrganization } from "@/server/features/reports/services/WeeklyReportService";

interface WeeklyReportParams {
  organizationId: string;
}

export class WeeklyReportWorkflow extends WorkflowEntrypoint<
  Env,
  WeeklyReportParams
> {
  async run(event: WorkflowEvent<WeeklyReportParams>, step: WorkflowStep) {
    const { organizationId } = event.payload;

    if (!organizationId) {
      throw new NonRetryableError("Weekly report workflow missing organizationId");
    }

    await step.do(
      "deliver-weekly-report",
      {
        retries: { limit: 2, delay: "30 seconds" },
        timeout: "5 minutes",
      },
      async () => {
        const result = await deliverWeeklyReportForOrganization(organizationId);
        if (!result.ok) {
          console.log(
            `[weekly-report] Workflow finished without send for ${organizationId}: ${result.reason}`,
          );
        }
      },
    );
  }
}
