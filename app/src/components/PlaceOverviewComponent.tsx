import React from 'react';
import { APILoader, PlaceOverview, PlaceDirectionsButton } from '@googlemaps/extended-component-library/react';

type PlaceOverviewComponentProps = {
  apiKey: string;
  placeId: string;
};

const PlaceOverviewComponent = ({ apiKey, placeId }: PlaceOverviewComponentProps) => {
  return (
    <div className="place-overview-container">
      <APILoader apiKey={apiKey} solutionChannel="GMP_GCC_placeoverview_v1_xl" />
      <PlaceOverview place={placeId} size="medium">
        <PlaceDirectionsButton slot="action">Directions</PlaceDirectionsButton>
      </PlaceOverview>
    </div>
  );
};

export default PlaceOverviewComponent;
