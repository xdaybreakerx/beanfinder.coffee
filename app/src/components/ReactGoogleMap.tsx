import React from "react";

import { APIProvider, Map } from "@vis.gl/react-google-maps";

const ReactGoogleMap = ({ apiKey }) => {
    return (
      <APIProvider apiKey={apiKey}>
        <Map
          style={{ width: "100%", height: "500px" }}
          defaultCenter={{ lat: 22.54992, lng: 0 }}
          defaultZoom={3}
          gestureHandling={"greedy"}
          disableDefaultUI={true}
        />
      </APIProvider>
    );
  };

// export default ReactGoogleMapComponent;
export default ReactGoogleMap;