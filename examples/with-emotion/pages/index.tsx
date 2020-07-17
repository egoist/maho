import React from 'react'
import styled from '@emotion/styled'

const StyledButton = styled.button`
  background: tomato;
  border: none;
  padding: 10px;
  color: white;
`

export default () => {
  return <div>
    <StyledButton>Tomato button</StyledButton>
  </div>
}
