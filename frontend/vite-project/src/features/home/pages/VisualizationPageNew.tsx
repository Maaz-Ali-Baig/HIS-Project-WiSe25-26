import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../../store/auth";
import { getFileData } from "../api/uploads";
import { FileLayout } from "../../../components/layout/FileLayout";
import { ActionSidebarItem } from "../../../components/layout/ActionSidebarItem";
import { VisualizationDisplay } from "@/features/home/components/VisualizationDisplay";
import { UnivariateVisualizationPanel } from "@/features/home/components/UnivariateVisualizationPanel";
import { BivariateVisualizationPanel } from "@/features/home/components/BivariateVisualizationPanel";
import { AssociationVisualizationPanel } from "@/features/home/components/AssociationVisualizationPanel";
import type { PlotResponse } from "../api/visualization";

export function VisualizationPageNew() {
  const navigate = useNavigate();
  const { fileId } = useParams<{ fileId?: string }>();
  const { user } = useAuthStore();
  const [plotData, setPlotData] = useState<PlotResponse | null>(null);

  useEffect(() => {
    if (!fileId) {
      navigate("/");
    }
  }, [fileId, navigate]);

  const {
    data: fileData,
    isLoading: isLoadingData,
    error: dataError,
  } = useQuery({
    queryKey: ["fileData", user?.id, fileId],
    queryFn: () =>
      getFileData({
        userId: user!.id,
        fileId: fileId!,
      }),
    enabled: Boolean(user?.id && fileId),
    retry: 1,
  });

  if (!user || !fileId) {
    return null;
  }

  const actions = [];

  if (fileData) {
    actions.push(
      <ActionSidebarItem key="univariate" title="UNIVARIATE ANALYSIS">
        <UnivariateVisualizationPanel
          fileData={fileData}
          userId={user.id}
          fileId={fileId}
          onPlotGenerated={setPlotData}
        />
      </ActionSidebarItem>
    );

    actions.push(
      <ActionSidebarItem key="bivariate" title="BIVARIATE ANALYSIS">
        <BivariateVisualizationPanel
          fileData={fileData}
          userId={user.id}
          fileId={fileId}
          onPlotGenerated={setPlotData}
        />
      </ActionSidebarItem>
    );

    actions.push(
      <ActionSidebarItem key="association" title="ASSOCIATION ANALYSIS">
        <AssociationVisualizationPanel
          fileData={fileData}
          userId={user.id}
          fileId={fileId}
          onPlotGenerated={setPlotData}
        />
      </ActionSidebarItem>
    );
  }

  return (
    <FileLayout actions={actions}>
      <VisualizationDisplay plotData={plotData} />
    </FileLayout>
  );
}
