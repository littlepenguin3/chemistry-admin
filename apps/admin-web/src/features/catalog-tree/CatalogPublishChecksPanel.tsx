import { Alert, Divider, Spin, Typography } from "antd";
import type { UseQueryResult } from "@tanstack/react-query";

import type { CatalogNodeDetail, CatalogValidation } from "../../api/catalogTree";

const { Text, Title } = Typography;

export function CatalogPublishChecksPanel({
  detail,
  validation,
}: {
  detail: CatalogNodeDetail;
  validation: UseQueryResult<CatalogValidation>;
}) {
  const activeValidation = validation.data || detail.validation;

  return (
    <section className="catalog-editor-section catalog-editor-panel-section">
      <div className="catalog-panel-title-row">
        <div>
          <Title level={4}>发布检查</Title>
          <Text type="secondary">这里集中显示发布前需要处理的问题，避免干扰日常内容编辑。</Text>
        </div>
        {validation.isFetching ? <Spin size="small" /> : null}
      </div>
      {activeValidation.errors?.length ? (
        <Alert type="error" showIcon title="发布前需要修复" description={activeValidation.errors.join("；")} />
      ) : (
        <Alert type="success" showIcon title="当前节点可发布" />
      )}
      {activeValidation.warnings?.length ? (
        <>
          <Divider />
          <Alert type="warning" showIcon title="提示" description={activeValidation.warnings.join("；")} />
        </>
      ) : null}
      {activeValidation.nodes?.length ? (
        <>
          <Divider />
          <div className="catalog-validation-node-list">
            {activeValidation.nodes.map((item) => (
              <div key={item.node_id}>
                <strong>{item.title}</strong>
                <span>{[...item.errors, ...item.warnings].join("；") || "ok"}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
