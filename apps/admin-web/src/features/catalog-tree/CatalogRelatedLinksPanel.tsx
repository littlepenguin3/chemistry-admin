import { Button, Form, Input, InputNumber, Select, Typography, type FormInstance } from "antd";
import { DeleteOutlined, LinkOutlined, SaveOutlined, SearchOutlined } from "@ant-design/icons";
import type { UseQueryResult } from "@tanstack/react-query";

import type { CatalogNodeCard, CatalogNodeDetail, CatalogSearchResponse } from "../../api/catalogTree";
import type { CatalogMutations } from "./catalogTreeHooks";
import {
  buildCatalogRelatedLinksPayload,
  catalogNodeKindLabel,
  isPointCapable,
  type CatalogRelatedLinksFormValues,
} from "./catalogTreeMappers";

const { Text, Title } = Typography;

export function CatalogRelatedLinksPanel({
  detail,
  linksForm,
  relatedQuery,
  setRelatedQuery,
  relatedSearch,
  mutations,
}: {
  detail: CatalogNodeDetail;
  linksForm: FormInstance<CatalogRelatedLinksFormValues>;
  relatedQuery: string;
  setRelatedQuery: (value: string) => void;
  relatedSearch: UseQueryResult<CatalogSearchResponse>;
  mutations: CatalogMutations;
}) {
  const { node } = detail;
  const relatedTargetOptions = (relatedSearch.data?.items || [])
    .filter((item: CatalogNodeCard) => isPointCapable(item.node_kind) && item.node_id !== node.node_id)
    .map((item: CatalogNodeCard) => ({ value: item.node_id, label: `${item.title} · ${catalogNodeKindLabel(item.node_kind)}` }));

  if (!isPointCapable(node.node_kind)) {
    return (
      <section className="catalog-editor-section catalog-editor-panel-section">
        <Title level={4}>相关实验</Title>
        <Text type="secondary">目录节点只是分类入口，不维护点位间相关实验链接。</Text>
      </section>
    );
  }

  return (
    <section className="catalog-editor-section catalog-editor-panel-section">
      <div>
        <Title level={4}>相关实验链接</Title>
        <Text type="secondary">可覆盖同目录/邻近点位生成的默认相关实验。</Text>
      </div>
      <Input
        prefix={<SearchOutlined />}
        value={relatedQuery}
        onChange={(event) => setRelatedQuery(event.target.value)}
        placeholder="搜索可关联点位"
        className="catalog-related-search"
      />
      <Form
        form={linksForm}
        layout="vertical"
        onFinish={(values) => mutations.saveRelatedLinks.mutate({ nodeId: node.node_id, payload: buildCatalogRelatedLinksPayload(values) })}
      >
        <Form.List name="links">
          {(fields, { add, remove }) => (
            <div className="catalog-related-list">
              {fields.map((field) => (
                <div className="catalog-related-row" key={field.key}>
                  <Form.Item name={[field.name, "target_node_id"]} label="目标点位" rules={[{ required: true, message: "请选择目标点位" }]}>
                    <Select showSearch placeholder="目标点位 Node ID" options={relatedTargetOptions} loading={relatedSearch.isFetching} />
                  </Form.Item>
                  <Form.Item name={[field.name, "relation_type"]} label="关系">
                    <Select
                      options={[
                        { value: "manual", label: "手动关联" },
                        { value: "default_override", label: "默认覆盖" },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item name={[field.name, "sort_order"]} label="顺序">
                    <InputNumber min={1} className="full" />
                  </Form.Item>
                  <Form.Item name={[field.name, "label"]} label="显示名">
                    <Input placeholder="可留空" />
                  </Form.Item>
                  <Button danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} aria-label="删除相关链接" />
                </div>
              ))}
              <Button icon={<LinkOutlined />} onClick={() => add({ relation_type: "manual", hidden: false, sort_order: fields.length + 1 })}>
                添加相关链接
              </Button>
            </div>
          )}
        </Form.List>
        <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={mutations.saveRelatedLinks.isPending}>
          保存相关链接
        </Button>
      </Form>
    </section>
  );
}
