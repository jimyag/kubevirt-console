import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const volumeuploadsourcesConfig: ResourceConfig = shared.cdiResourceConfig({ plural: "volumeuploadsources", path: "/kubevirt/cdi/volume-upload-sources", title: "VolumeUploadSources", subtitle: "Manage CDI VolumeUploadSource resources", kind: "VolumeUploadSource", namespaced: true, createFields: [...shared.namespaceNameFields("example-upload-source")], buildSpec: () => ({}) });
