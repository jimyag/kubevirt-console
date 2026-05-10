import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const storageprofilesConfig: ResourceConfig = shared.cdiResourceConfig({ plural: "storageprofiles", path: "/kubevirt/cdi/storage-profiles", title: "StorageProfiles", subtitle: "Manage CDI StorageProfile resources", kind: "StorageProfile", createFields: [...shared.nameOnlyFields("standard")], buildSpec: () => ({}), statusPath: ["status", "storageClass"] });
