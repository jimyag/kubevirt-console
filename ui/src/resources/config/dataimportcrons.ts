import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const dataimportcronsConfig: ResourceConfig = shared.cdiResourceConfig({
    plural: "dataimportcrons",
    path: "/kubevirt/cdi/data-import-crons",
    title: "DataImportCrons",
    subtitle: "Manage CDI DataImportCron resources",
    kind: "DataImportCron",
    namespaced: true,
    createFields: [...shared.namespaceNameFields("example-import-cron"), { name: "schedule", label: "Schedule", section: "Schedule", defaultValue: "0 0 * * *" }, { name: "url", label: "HTTP URL", section: "Source", defaultValue: "https://example.com/disk.qcow2" }, { name: "storage", label: "Storage", section: "Storage", defaultValue: "10Gi" }],
    buildSpec: (values) => ({ schedule: shared.stringValue(values.schedule, "0 0 * * *"), template: { spec: { source: { http: { url: shared.stringValue(values.url, "https://example.com/disk.qcow2") } }, storage: { resources: { requests: { storage: shared.stringValue(values.storage, "10Gi") } } } } } }),
    statusPath: ["status", "currentImports", "0"],
  });
