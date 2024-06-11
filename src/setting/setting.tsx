import { React } from 'jimu-core';
import { AllWidgetSettingProps } from 'jimu-for-builder';
import {
  MapWidgetSelector,
  SettingSection,
  SettingRow
} from 'jimu-ui/advanced/setting-components';
import '../runtime/widget.css';

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
        <SettingRow>軌跡選取標題</SettingRow>
        <SettingRow>
          <textarea
              className="w-100 p-1"
              style={{ whiteSpace: 'wrap', minHeight: '40px' }}
              value={props.config.comboTraceHead}
              onChange={(e) => propChange('comboTraceHead', e.target.value)}
          ></textarea>
        </SettingRow>
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
    </div>
  );
};

export default Setting;
