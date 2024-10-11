import { React, Immutable, AllDataSourceTypes } from 'jimu-core';
import { AllWidgetSettingProps } from 'jimu-for-builder';
import {
  MapWidgetSelector,
  SettingSection,
  SettingRow
} from 'jimu-ui/advanced/setting-components';
import '../runtime/widget.css';

import { DataSourceSelector } from 'jimu-ui/advanced/data-source-selector'

const Setting = (props: AllWidgetSettingProps<IMConfig>) => {

  const propChange = (obj: string, value: any) => {
    props.onSettingChange({
      id: props.id,
      config: {
        ...props.config,
        [obj]: value
      }
    });
  };

  const onMapWidgetSelected = (useMapWidgetId: string[]) => {
    props.onSettingChange({
      id: props.id,
      useMapWidgetIds: useMapWidgetId
    });
  };


  const onToggleUseDataEnabled = (useDataSourcesEnabled: boolean) => {
    props.onSettingChange({
      id: props.id,
      useDataSourcesEnabled
    })
  }

  const onDataSourceChange = (useDataSources: UseDataSource[]) => {
    props.onSettingChange({
      id: props.id,
      useDataSources: useDataSources
    })
  }


  return (
    <div>
      <SettingSection title="地圖選取:">
        <SettingRow>
          <MapWidgetSelector
            onSelect={onMapWidgetSelected}
            useMapWidgetIds={props.useMapWidgetIds}
          />
        </SettingRow>
      </SettingSection>      
      <SettingSection title="作業參數:">        
        <SettingRow>主機端服務程式根路徑</SettingRow>
        <SettingRow>
          <textarea
              className="w-100 p-1"
              style={{ whiteSpace: 'wrap', minHeight: '40px' }}
              value={props.config.serverProgRootURL}
              onChange={(e) => propChange('serverProgRootURL', e.target.value)}
          ></textarea>
        </SettingRow>
      </SettingSection>
      <SettingSection title="資料源:">
        <DataSourceSelector
          types={Immutable([AllDataSourceTypes.FeatureLayer])}
          useDataSources={props.useDataSources}
          useDataSourcesEnabled={props.useDataSourcesEnabled}
          onToggleUseDataEnabled={onToggleUseDataEnabled}
          onChange={onDataSourceChange}
          widgetId={props.id}
          isMultiple={true}
        />
      </SettingSection>      
    </div>
  );
};

export default Setting;
