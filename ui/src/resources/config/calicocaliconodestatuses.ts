import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const calicoCalicoNodeStatusesConfig: ResourceConfig = shared.calicoResourceConfig({ plural: "caliconodestatuses", path: "/networks/calico/node-statuses", title: "Calico Node Statuses", subtitle: "Inspect CalicoNodeStatus resources", kind: "CalicoNodeStatus", allowCreate: false, allowDelete: false, statusPath: ["status", "agent", "birdV4", "state"] });
