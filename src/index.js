import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter } from 'react-router-dom';
import { MotorismoApp } from './MotorismoApp';

import './styles/styles.scss';

ReactDOM.render(
  <React.StrictMode>
    <BrowserRouter>
      <MotorismoApp />
    </BrowserRouter>
  </React.StrictMode>,
  document.getElementById('root')
);
