// Libraries
import React, { FC } from 'react';

// Types
import { DataSourceSettings, LayoutMode } from '@grafana/data';
import { Card, IconButton, Tag, useStyles } from '@grafana/ui';
import { css } from '@emotion/css';

export interface Props {
  dataSources: DataSourceSettings[];
  layoutMode: LayoutMode;
}

export const DataSourcesList: FC<Props> = ({ dataSources, layoutMode }) => {
  const styles = useStyles(getStyles);

  return (
    <ul className={styles.list}>
      {dataSources.map((dataSource, index) => {
        return (
          <li style={{ display: 'inline-block', width: '48%', marginRight: '8px' }} key={dataSource.id}>
            <Card heading={dataSource.name} href={`datasources/edit/${dataSource.uid}`}>
              <Card.Figure>
                <img src={dataSource.typeLogoUrl} alt={dataSource.name} />
              </Card.Figure>
              <Card.Meta>
                {[
                  dataSource.typeName,
                  dataSource.url,
                  dataSource.isDefault && <Tag key="default-tag" name={'default'} colorIndex={1} />,
                ]}
              </Card.Meta>
              <Card.SecondaryActions>
                <IconButton key="showAll" name="apps" tooltip="Show all dashboards for this data source" />
                <IconButton key="compass" name="compass" tooltip="Go to explore for this datasource" />
              </Card.SecondaryActions>
            </Card>
          </li>
        );
      })}
    </ul>
  );
};

export default DataSourcesList;

const getStyles = () => {
  return {
    list: css`
      list-style: none;
    `,
  };
};
