import { useMemo, useState } from "react";
import { Button, Empty, Form, Input, Space, Tag, Tooltip, Typography, type FormInstance } from "antd";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  HolderOutlined,
  SaveOutlined,
  SearchOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import type { UseQueryResult } from "@tanstack/react-query";

import type { CatalogNodeCard, CatalogNodeDetail, CatalogSearchResponse } from "../../api/catalogTree";
import type { CatalogMutations } from "./catalogTreeHooks";
import {
  buildCatalogRelatedLinksPayload,
  catalogNodeKindLabel,
  isPointCapable,
  type CatalogRelatedLinkFormItem,
  type CatalogRelatedLinksFormValues,
} from "./catalogTreeMappers";

const { Text, Title } = Typography;

function relatedLinkTitle(link: CatalogRelatedLinkFormItem): string {
  return link.label?.trim() || link.target_title?.trim() || link.target_node_id || "未命名实验";
}

function relatedLinkSourceLabel(link: CatalogRelatedLinkFormItem): string {
  if (link.relation_type === "generated_default") return String(link.metadata?.default_scope_label || "同目录默认");
  if (link.relation_type === "default_override") return "已调整默认";
  return "手动添加";
}

function relatedLinkSourceColor(link: CatalogRelatedLinkFormItem): string {
  if (link.relation_type === "generated_default") return "green";
  if (link.relation_type === "default_override") return "gold";
  return "blue";
}

function uniqueRelatedLinks(links: CatalogRelatedLinkFormItem[]): CatalogRelatedLinkFormItem[] {
  const seen = new Set<string>();
  return links.filter((link) => {
    const targetNodeId = String(link.target_node_id || "").trim();
    if (!targetNodeId || seen.has(targetNodeId)) return false;
    seen.add(targetNodeId);
    return true;
  });
}

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
  const watchedLinks = Form.useWatch("links", linksForm) || [];
  const links = uniqueRelatedLinks(watchedLinks);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const selectedTargetIds = useMemo(() => new Set(links.map((link) => link.target_node_id).filter(Boolean)), [links]);
  const relatedCandidates = (relatedSearch.data?.items || []).filter(
    (item: CatalogNodeCard) => isPointCapable(item.node_kind) && item.node_id !== node.node_id,
  );
  const defaultCount = links.filter((link) => link.relation_type === "generated_default" || link.relation_type === "default_override").length;
  const manualCount = links.filter((link) => link.relation_type === "manual").length;

  const setLinks = (nextLinks: CatalogRelatedLinkFormItem[]) => {
    linksForm.setFieldsValue({
      links: uniqueRelatedLinks(nextLinks).map((link, index) => ({
        ...link,
        sort_order: index + 1,
      })),
    });
  };

  const addCandidate = (item: CatalogNodeCard) => {
    setLinks([
      ...links,
      {
        target_node_id: item.node_id,
        target_title: item.title,
        relation_type: "manual",
        source: "manual",
        hidden: false,
        sort_order: links.length + 1,
        label: "",
        metadata: {},
      },
    ]);
  };

  const moveLink = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= links.length || fromIndex === toIndex) return;
    const nextLinks = [...links];
    const [item] = nextLinks.splice(fromIndex, 1);
    nextLinks.splice(toIndex, 0, item);
    setLinks(nextLinks);
  };

  const removeLink = (index: number) => {
    setLinks(links.filter((_, itemIndex) => itemIndex !== index));
  };

  const resetToDefault = () => {
    linksForm.setFieldsValue({ links: [] });
    mutations.saveRelatedLinks.mutate({ nodeId: node.node_id, payload: { links: [] } });
  };

  if (!isPointCapable(node.node_kind)) {
    return (
      <section className="catalog-editor-section catalog-editor-panel-section">
        <Title level={4}>相关实验</Title>
        <Text type="secondary">目录节点只是分类入口，不维护实验之间的相关实验列表。</Text>
      </section>
    );
  }

  return (
    <section className="catalog-editor-section catalog-editor-panel-section">
      <div className="catalog-panel-title-row">
        <div>
          <Title level={4}>相关实验</Title>
          <Text type="secondary">默认采用同一直接父目录下的其他实验；拖动可调整顺序，也可以搜索并手动添加跨目录实验。</Text>
        </div>
        <Space wrap>
          <Tag color="green">默认 {defaultCount}</Tag>
          <Tag color="blue">手动 {manualCount}</Tag>
          <Button icon={<UndoOutlined />} onClick={resetToDefault} loading={mutations.saveRelatedLinks.isPending}>
            重置为同目录默认
          </Button>
        </Space>
      </div>

      <Form
        form={linksForm}
        layout="vertical"
        onFinish={(values) => mutations.saveRelatedLinks.mutate({ nodeId: node.node_id, payload: buildCatalogRelatedLinksPayload(values) })}
      >
        <Form.List name="links">
          {(fields) => (
            <div className="catalog-related-builder">
              <div className="catalog-related-list">
                {fields.length ? (
                  fields.map((field, index) => {
                    const link = links[index] || {};
                    return (
                      <div
                        className="catalog-related-card"
                        draggable
                        key={field.key}
                        onDragStart={() => setDragIndex(index)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          if (dragIndex !== null) moveLink(dragIndex, index);
                          setDragIndex(null);
                        }}
                        onDragEnd={() => setDragIndex(null)}
                      >
                        <Form.Item name={[field.name, "target_node_id"]} hidden>
                          <Input />
                        </Form.Item>
                        <Form.Item name={[field.name, "target_title"]} hidden>
                          <Input />
                        </Form.Item>
                        <Form.Item name={[field.name, "relation_type"]} hidden>
                          <Input />
                        </Form.Item>
                        <Form.Item name={[field.name, "source"]} hidden>
                          <Input />
                        </Form.Item>
                        <Form.Item name={[field.name, "sort_order"]} hidden>
                          <Input />
                        </Form.Item>

                        <Tooltip title="拖动调整顺序">
                          <Button className="catalog-related-drag-handle" icon={<HolderOutlined />} aria-label="拖动调整相关实验顺序" />
                        </Tooltip>
                        <div className="catalog-related-card-copy">
                          <div className="catalog-related-card-title">
                            <strong>{relatedLinkTitle(link)}</strong>
                            <Tag color={relatedLinkSourceColor(link)}>{relatedLinkSourceLabel(link)}</Tag>
                          </div>
                          <Form.Item name={[field.name, "label"]} label="显示名称" extra="可为空；为空时使用目标实验标题。">
                            <Input placeholder="可选：给学生端显示的短名称" />
                          </Form.Item>
                        </div>
                        <Space className="catalog-related-card-actions">
                          <Tooltip title="上移">
                            <Button icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => moveLink(index, index - 1)} aria-label="上移相关实验" />
                          </Tooltip>
                          <Tooltip title="下移">
                            <Button
                              icon={<ArrowDownOutlined />}
                              disabled={index === fields.length - 1}
                              onClick={() => moveLink(index, index + 1)}
                              aria-label="下移相关实验"
                            />
                          </Tooltip>
                          <Tooltip title="移除">
                            <Button danger icon={<DeleteOutlined />} onClick={() => removeLink(index)} aria-label="移除相关实验" />
                          </Tooltip>
                        </Space>
                      </div>
                    );
                  })
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前使用系统默认同目录相关实验" />
                )}
              </div>

              <div className="catalog-related-search-panel">
                <Input
                  prefix={<SearchOutlined />}
                  value={relatedQuery}
                  onChange={(event) => setRelatedQuery(event.target.value)}
                  placeholder="搜索要手动加入的实验"
                  className="catalog-related-search"
                />
                <div className="catalog-related-candidates">
                  {relatedQuery.trim().length < 2 ? <Text type="secondary">输入至少 2 个字搜索跨目录或同级目录中的实验。</Text> : null}
                  {relatedCandidates.map((item) => {
                    const selected = selectedTargetIds.has(item.node_id);
                    return (
                      <button className="catalog-related-candidate" key={item.node_id} type="button" onClick={() => addCandidate(item)} disabled={selected}>
                        <span>
                          <strong>{item.title}</strong>
                          <small>{catalogNodeKindLabel(item.node_kind)}</small>
                        </span>
                        <Tag color={selected ? "default" : "blue"}>{selected ? "已在列表" : "加入"}</Tag>
                      </button>
                    );
                  })}
                  {relatedQuery.trim().length >= 2 && !relatedSearch.isFetching && !relatedCandidates.length ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有找到可添加的实验" />
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </Form.List>
        <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={mutations.saveRelatedLinks.isPending}>
          保存相关实验
        </Button>
      </Form>
    </section>
  );
}
