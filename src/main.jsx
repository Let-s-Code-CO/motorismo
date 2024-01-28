import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';

import { MotorismoApp } from './MotorismoApp';
import { store } from './store';
import './styles.scss';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={ store }>
      <BrowserRouter>
        <MotorismoApp />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
)
